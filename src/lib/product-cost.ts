import { prisma } from "./prisma";
import {
  calculateProductCost,
  cutVolumeCm3,
  spongeCostFromYield,
  type BlockYieldEntry,
  type ProductCostBreakdown,
  type ProductCostInput,
} from "./costing";

/**
 * Loads a product with its full bill-of-materials and returns the computed
 * cost breakdown. Keeping this on the server keeps the DB layer out of UI.
 *
 * Sponge allocation:
 *   - If the sponge block has a `SpongeYield` entry that includes this
 *     product, we split the block cost by volume share across every product
 *     in the cutting plan.
 *   - Otherwise we fall back to per-product allocation with waste factor.
 */
export async function resolveProductCost(
  productId: string,
  visited: Set<string> = new Set(),
): Promise<{
  product: NonNullable<Awaited<ReturnType<typeof loadProduct>>>;
  breakdown: ProductCostBreakdown;
}> {
  if (visited.has(productId)) {
    throw new Error(`Composition cycle detected at product ${productId}`);
  }
  visited.add(productId);

  const product = await loadProduct(productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  // Resolve per-sponge cost: yield-based when available, else fallback.
  const spongeInputs: ProductCostInput["sponges"] = [];
  const yieldSpongeCosts: number[] = []; // dollar-cost contributions from yield-based blocks

  for (const ps of product.sponges) {
    const yields = ps.sponge.yields;
    const hasMe = yields.some((y) => y.productId === product.id);

    if (yields.length > 0 && hasMe) {
      // Yield-based: compute the per-unit cost directly.
      const entries: BlockYieldEntry[] = await Promise.all(
        yields.map(async (y) => ({
          productId: y.productId,
          unitsPerBlock: y.unitsPerBlock,
          cutVolumePerUnit: await cutVolumeForProductFromBlock(
            y.productId,
            ps.sponge.id,
          ),
        })),
      );
      const perUnit = spongeCostFromYield(ps.sponge, product.id, entries);
      yieldSpongeCosts.push(perUnit);
    } else {
      // No yield plan → use per-product allocation. If the user set a manual
      // `unitsPerBlockOverride` on the BOM line, it takes precedence over the
      // geometric calculation.
      spongeInputs.push({
        block: {
          widthCm: ps.sponge.widthCm,
          depthCm: ps.sponge.depthCm,
          heightCm: ps.sponge.heightCm,
          density: ps.sponge.density,
          pricePerDensity: ps.sponge.pricePerDensity,
          wastePct: ps.sponge.wastePct,
        },
        cuts: [
          {
            cutWidthCm: ps.cutWidthCm,
            cutDepthCm: ps.cutDepthCm,
            cutHeightCm: ps.cutHeightCm,
            cuts: ps.cuts,
          },
        ],
        unitsPerBlockOverride: ps.unitsPerBlockOverride,
      });
    }
  }

  // Resolve cost contributions from sub-products (composition / bundle).
  let compositionCost = 0;
  for (const c of product.compositions ?? []) {
    const child = await resolveProductCost(c.childProductId, new Set(visited));
    compositionCost += child.breakdown.totalCost * c.quantity;
  }

  const input: ProductCostInput & { compositionCost: number } = {
    compositionCost,
    sponges: spongeInputs,
    fabrics: product.fabrics.map((pf) => ({
      meters: pf.meters,
      costPerMeter: pf.fabric.costPerMeter,
    })),
    fibers: product.bulkMaterials
      .filter((b) => b.bulkMaterial.kind === "FIBER")
      .map((b) => ({ grams: b.grams, costPerKg: b.bulkMaterial.costPerKg })),
    packaging: product.bulkMaterials
      .filter((b) => b.bulkMaterial.kind === "PACKAGING")
      .map((b) => ({ grams: b.grams, costPerKg: b.bulkMaterial.costPerKg })),
    extras: product.bulkMaterials
      .filter((b) => b.bulkMaterial.kind === "EXTRA")
      .map((b) => ({ grams: b.grams, costPerKg: b.bulkMaterial.costPerKg })),
    manufacturing: product.manufacturing.map((m) => ({
      label: m.label,
      amount: m.amount,
    })),
    retailPrice: product.retailPrice,
    wholesalePrice: product.wholesalePrice,
  };

  const baseBreakdown = calculateProductCost(input);

  // Add yield-based sponge contributions on top.
  const yieldExtra = yieldSpongeCosts.reduce((a, b) => a + b, 0);
  const breakdown: ProductCostBreakdown = {
    ...baseBreakdown,
    spongeCost: round(baseBreakdown.spongeCost + yieldExtra),
    totalCost: round(baseBreakdown.totalCost + yieldExtra),
    retailProfit: round(product.retailPrice - (baseBreakdown.totalCost + yieldExtra)),
    retailMarginPct:
      product.retailPrice > 0
        ? round(
            ((product.retailPrice - (baseBreakdown.totalCost + yieldExtra)) /
              product.retailPrice) *
              100,
          )
        : 0,
    wholesaleProfit: round(
      product.wholesalePrice - (baseBreakdown.totalCost + yieldExtra),
    ),
    wholesaleMarginPct:
      product.wholesalePrice > 0
        ? round(
            ((product.wholesalePrice - (baseBreakdown.totalCost + yieldExtra)) /
              product.wholesalePrice) *
              100,
          )
        : 0,
  };

  return { product, breakdown };
}

/**
 * Volume of one cut of `productId` taken from `spongeId` — looks up the
 * matching ProductSponge row. Returns 0 if the product doesn't have a BOM
 * line for that block.
 */
async function cutVolumeForProductFromBlock(
  productId: string,
  spongeId: string,
): Promise<number> {
  const row = await prisma.productSponge.findFirst({
    where: { productId, spongeId },
  });
  if (!row) return 0;
  return cutVolumeCm3({
    cutWidthCm: row.cutWidthCm,
    cutDepthCm: row.cutDepthCm,
    cutHeightCm: row.cutHeightCm,
    cuts: row.cuts,
  });
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function loadProduct(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      sponges: {
        include: {
          sponge: {
            include: {
              yields: true,
            },
          },
        },
      },
      fabrics: { include: { fabric: true } },
      bulkMaterials: { include: { bulkMaterial: true } },
      manufacturing: true,
      compositions: { include: { child: true } },
      // Variant system
      parent: { select: { id: true, name: true, variantName: true } },
      variants: { select: { id: true, name: true, variantName: true, sku: true }, orderBy: { variantName: "asc" } },
    },
  });
}

export type ResolvedProduct = NonNullable<
  Awaited<ReturnType<typeof loadProduct>>
>;
