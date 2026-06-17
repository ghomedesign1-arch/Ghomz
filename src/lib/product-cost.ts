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

  // ── Pre-fetch every ProductSponge row we'll need to evaluate the yield
  //    plans, in a single round-trip. Before this change each yield entry
  //    fired its own SELECT, producing an N+1 storm on product pages with
  //    multiple sponges. Now the loops below resolve from an in-memory map.
  //
  // Note: we use Array helpers (filter / Object.keys) rather than `[...new Set()]`
  // because the project's tsconfig doesn't set `target` (defaults to ES3) and
  // Set spread requires ES2015+ or `downlevelIteration`.
  const yieldLookupKeys: string[] = []; // "<productId>:<spongeId>"
  const seenKeys: Record<string, true> = {};
  for (const ps of product.sponges) {
    if (
      ps.sponge.yields.length > 0 &&
      ps.sponge.yields.some((y) => y.productId === product.id)
    ) {
      for (const y of ps.sponge.yields) {
        const key = `${y.productId}:${ps.sponge.id}`;
        if (!seenKeys[key]) {
          seenKeys[key] = true;
          yieldLookupKeys.push(key);
        }
      }
    }
  }
  const cutVolByKey: Record<string, number> = {};
  if (yieldLookupKeys.length > 0) {
    const productIdSet: Record<string, true> = {};
    const spongeIdSet:  Record<string, true> = {};
    for (const k of yieldLookupKeys) {
      const [p, s] = k.split(":");
      productIdSet[p] = true;
      spongeIdSet[s]  = true;
    }
    const rows = await prisma.productSponge.findMany({
      where: {
        productId: { in: Object.keys(productIdSet) },
        spongeId:  { in: Object.keys(spongeIdSet)  },
      },
      select: {
        productId: true, spongeId: true,
        cutWidthCm: true, cutDepthCm: true, cutHeightCm: true, cuts: true,
      },
    });
    for (const r of rows) {
      cutVolByKey[`${r.productId}:${r.spongeId}`] = cutVolumeCm3(r);
    }
  }

  // ── Per-sponge cost: yield-based when available, else fallback.
  //    No async work needed here anymore — all data is pre-loaded.
  const spongeInputs: ProductCostInput["sponges"] = [];
  const yieldSpongeCosts: number[] = [];

  for (const ps of product.sponges) {
    const yields = ps.sponge.yields;
    const hasMe = yields.some((y) => y.productId === product.id);

    if (yields.length > 0 && hasMe) {
      const entries: BlockYieldEntry[] = yields.map((y) => ({
        productId: y.productId,
        unitsPerBlock: y.unitsPerBlock,
        cutVolumePerUnit: cutVolByKey[`${y.productId}:${ps.sponge.id}`] ?? 0,
      }));
      yieldSpongeCosts.push(spongeCostFromYield(ps.sponge, product.id, entries));
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

  // ── Resolve sub-product cost contributions in parallel rather than serially
  //    so a product with N children pays max(child_time) instead of sum.
  let compositionCost = 0;
  if ((product.compositions ?? []).length > 0) {
    const childResults = await Promise.all(
      product.compositions.map((c) =>
        resolveProductCost(c.childProductId, new Set(visited)).then((res) => ({
          totalCost: res.breakdown.totalCost,
          quantity: c.quantity,
        })),
      ),
    );
    compositionCost = childResults.reduce(
      (acc, r) => acc + r.totalCost * r.quantity,
      0,
    );
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
    pocketCoils: (product.pocketCoils ?? []).map((pc) => ({
      quantity: pc.quantity,
      costPerUnit: pc.pocketCoil.costPerUnit,
    })),
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
      pocketCoils: { include: { pocketCoil: true } },
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
