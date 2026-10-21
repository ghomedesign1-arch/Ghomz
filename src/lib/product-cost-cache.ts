import { prisma } from "./prisma";
import { resolveProductCost } from "./product-cost";

/**
 * Fast-path unit-cost resolver. Returns the cached BOM-derived unit cost
 * when present; otherwise falls back to a full live resolve and writes the
 * result back to the Product row so the next call is instant.
 *
 * Used by the catalog list, Shopify order resolution and anywhere else
 * that only needs the final number (not the per-category breakdown). The
 * product detail page still uses the live resolver because it renders the
 * full breakdown.
 */
export async function fastUnitCost(product: {
  id: string;
  retailPrice: number;
  cachedUnitCost: number | null;
}): Promise<{ unitCost: number; retailMarginPct: number }> {
  if (product.cachedUnitCost !== null && product.cachedUnitCost !== undefined) {
    const unitCost = product.cachedUnitCost;
    const retailMarginPct =
      product.retailPrice > 0
        ? ((product.retailPrice - unitCost) / product.retailPrice) * 100
        : 0;
    return { unitCost, retailMarginPct };
  }
  // Miss — compute live and write back.
  const { breakdown } = await resolveProductCost(product.id);
  await prisma.product
    .update({
      where: { id: product.id },
      data: {
        cachedUnitCost: breakdown.totalCost,
        cachedUnitCostAt: new Date(),
      },
    })
    .catch(() => {
      /* best-effort — a concurrent delete isn't fatal here */
    });
  return {
    unitCost: breakdown.totalCost,
    retailMarginPct: breakdown.retailMarginPct,
  };
}

/**
 * Invalidate the cached cost for the given products plus everything whose
 * cost derives from them: their parents (child cost rolls up) and anywhere
 * they appear as a composition child.
 */
export async function invalidateProductCosts(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const seeds = productIds;

  // Direct products + their parents (one hop up).
  const parents = await prisma.product.findMany({
    where: { id: { in: seeds } },
    select: { parentId: true },
  });
  const parentIds = parents
    .map((p) => p.parentId)
    .filter((v): v is string => Boolean(v));

  // Anything that lists one of these as a composition child.
  const uses = await prisma.productComposition.findMany({
    where: { childProductId: { in: seeds } },
    select: { parentProductId: true },
  });
  const compositionParents = uses.map((u) => u.parentProductId);

  // Walk composition parents one more hop up — a "set" could itself be part
  // of a bigger kit. Two levels covers every real case we have; cycles are
  // prevented by the BOM save route.
  const grandUses = await prisma.productComposition.findMany({
    where: { childProductId: { in: compositionParents } },
    select: { parentProductId: true },
  });
  const compositionGrandparents = grandUses.map((u) => u.parentProductId);

  const dedup = Array.from(
    new Set([
      ...seeds,
      ...parentIds,
      ...compositionParents,
      ...compositionGrandparents,
    ]),
  );
  if (dedup.length === 0) return;
  await prisma.product.updateMany({
    where: { id: { in: dedup } },
    data: { cachedUnitCost: null, cachedUnitCostAt: null },
  });
}

/**
 * Nuke the entire cache. Call this when a raw-material / sponge / fabric
 * price changes, since every product that uses it would otherwise show a
 * stale cost. Cheap: a single UPDATE statement.
 */
export async function invalidateAllProductCosts(): Promise<void> {
  await prisma.product.updateMany({
    where: { cachedUnitCost: { not: null } },
    data: { cachedUnitCost: null, cachedUnitCostAt: null },
  });
}
