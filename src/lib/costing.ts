// G-Homz costing engine.
//
// Pure functions only — no DB calls — so the same logic can run inside a
// React Server Component, an API route, or a future background worker.

export type SpongeBlock = {
  widthCm: number;
  depthCm: number;
  heightCm: number;
  density: number;
  pricePerDensity: number;
  wastePct?: number;
};

export type SpongeCut = {
  cutWidthCm: number;
  cutDepthCm: number;
  cutHeightCm: number;
  cuts: number;
};

export type ProductSpongeUsage = {
  block: SpongeBlock;
  cuts: SpongeCut[];
  /** Manual yield override: "this product yields N per block". When set,
   *  the engine uses `block_cost / N` instead of the volume-share math. */
  unitsPerBlockOverride?: number | null;
};

export type ProductFabricUsage = {
  meters: number;
  costPerMeter: number;
};

export type ProductBulkUsage = {
  grams: number;
  costPerKg: number;
};

export type ManufacturingLine = {
  label: string;
  amount: number;
};

export type ProductPocketCoilUsage = {
  /** Number of coils per finished product unit. */
  quantity: number;
  /** EGP per individual coil. */
  costPerUnit: number;
};

export type ProductCostInput = {
  sponges: ProductSpongeUsage[];
  fabrics: ProductFabricUsage[];
  fibers: ProductBulkUsage[];
  packaging: ProductBulkUsage[];
  extras?: ProductBulkUsage[];
  pocketCoils?: ProductPocketCoilUsage[];
  manufacturing: ManufacturingLine[];
  retailPrice?: number;
  wholesalePrice?: number;
};

export type ProductCostBreakdown = {
  spongeCost: number;
  fabricCost: number;
  fiberCost: number;
  packagingCost: number;
  extrasCost: number;
  pocketCoilCost: number;
  manufacturingCost: number;
  /// Cost contributed by sub-products this product is composed of.
  compositionCost: number;
  totalCost: number;
  retailPrice: number;
  wholesalePrice: number;
  retailProfit: number;
  retailMarginPct: number;
  wholesaleProfit: number;
  wholesaleMarginPct: number;
};

// ── Sponge ────────────────────────────────────────────────────────────────

export function spongeBlockVolumeCm3(block: SpongeBlock): number {
  return block.widthCm * block.depthCm * block.heightCm;
}

/**
 * Sponge block unit cost.
 *   Cost = W × D × H × density × pricePerDensity / 1_000_000
 *
 * The brand brief uses raw cm × density × pricePerDensity, but the example
 * given (240 × 200 × 120 × 26 × 220 ≈ 32,947 LE) requires dividing by 1e6
 * to land on the stated number. We keep the same convention so seed values
 * match the brief exactly.
 */
export function spongeBlockCost(block: SpongeBlock): number {
  const raw =
    block.widthCm *
    block.depthCm *
    block.heightCm *
    block.density *
    block.pricePerDensity;
  return raw / 1_000_000;
}

export function cutVolumeCm3(cut: SpongeCut): number {
  return cut.cutWidthCm * cut.cutDepthCm * cut.cutHeightCm * cut.cuts;
}

/**
 * How many full product units fit inside one sponge block. When the user has
 * set `unitsPerBlockOverride` on the BOM line, that value wins. Otherwise we
 * compute geometrically (cut volume vs usable block volume after waste).
 */
export function unitsPerBlock(usage: ProductSpongeUsage): number {
  if (
    usage.unitsPerBlockOverride !== undefined &&
    usage.unitsPerBlockOverride !== null &&
    usage.unitsPerBlockOverride > 0
  ) {
    return usage.unitsPerBlockOverride;
  }
  const blockVol = spongeBlockVolumeCm3(usage.block);
  const wasteFactor = 1 - (usage.block.wastePct ?? 0) / 100;
  const usableVol = blockVol * wasteFactor;
  const productVol = usage.cuts.reduce((sum, cut) => sum + cutVolumeCm3(cut), 0);
  if (productVol <= 0) return 0;
  return Math.floor(usableVol / productVol);
}

/**
 * Sponge cost contribution to a single product unit.
 *
 *  - If `unitsPerBlockOverride` is set:  cost = block_cost / override
 *    (the simple "I get N from this block" formula matching the catalogue PDF).
 *  - Otherwise: volume-share with waste factor.
 */
export function spongeCostForProduct(usage: ProductSpongeUsage): number {
  const blockCost = spongeBlockCost(usage.block);
  if (
    usage.unitsPerBlockOverride !== undefined &&
    usage.unitsPerBlockOverride !== null &&
    usage.unitsPerBlockOverride > 0
  ) {
    return blockCost / usage.unitsPerBlockOverride;
  }
  const blockVol = spongeBlockVolumeCm3(usage.block);
  const productVol = usage.cuts.reduce((sum, cut) => sum + cutVolumeCm3(cut), 0);
  if (blockVol <= 0) return 0;
  const baseShare = (productVol / blockVol) * blockCost;
  // Spread waste cost over the actual product (each unit absorbs its share).
  const wasteFactor = 1 / (1 - (usage.block.wastePct ?? 0) / 100);
  return baseShare * wasteFactor;
}

// ── Yield-based sponge allocation ─────────────────────────────────────────
//
// When a single sponge block produces a mix of products (e.g. "2 sofas + 6
// chairs from one Yellow 26 Soft block"), the block cost should be split
// across them by volume share. Each product's share = its used volume in the
// block ÷ total used volume across all products in the yield plan.

export interface BlockYieldEntry {
  productId: string;
  unitsPerBlock: number;
  /** Volume of one cut of this product from this block (cm³). */
  cutVolumePerUnit: number;
}

/**
 * Per-unit sponge cost for a product when the block has a yield plan with
 * multiple products. Returns 0 if the product isn't present in the plan.
 *
 * Allocation strategy:
 *   - If at least one yield entry has a non-zero `cutVolumePerUnit`, we use
 *     volume-weighted shares:
 *        share = (units × cutVolume) / Σ(units × cutVolume)
 *   - If ALL entries have `cutVolumePerUnit = 0` (the user opted out of
 *     entering cut dimensions on the BOM), we fall back to units-only
 *     weighting — each unit gets an equal slice of the block cost:
 *        share = units / Σ(units)
 *
 *   blockShare  = share × blockCost
 *   costPerUnit = blockShare / units
 */
export function spongeCostFromYield(
  block: SpongeBlock,
  thisProductId: string,
  yields: BlockYieldEntry[],
): number {
  const me = yields.find((y) => y.productId === thisProductId);
  if (!me || me.unitsPerBlock <= 0) return 0;

  const totalUnits = yields.reduce((acc, y) => acc + y.unitsPerBlock, 0);
  if (totalUnits <= 0) return 0;

  const totalVolume = yields.reduce(
    (acc, y) => acc + y.cutVolumePerUnit * y.unitsPerBlock,
    0,
  );
  const blockCost = spongeBlockCost(block);

  // Fall back to units-only weighting when no one has cut dims.
  if (totalVolume <= 0) {
    const share = me.unitsPerBlock / totalUnits;
    return (share * blockCost) / me.unitsPerBlock;
  }

  const myUsedVolume = me.cutVolumePerUnit * me.unitsPerBlock;
  if (myUsedVolume <= 0) {
    // Single entry has no cut dims while others do — give it equal-per-unit
    // weight relative to the rest. Same result as units-only fallback for
    // its own share.
    return blockCost / totalUnits;
  }
  const blockShareCost = (myUsedVolume / totalVolume) * blockCost;
  return blockShareCost / me.unitsPerBlock;
}

// ── Fabric ────────────────────────────────────────────────────────────────

export function fabricLineCost(usage: ProductFabricUsage): number {
  return usage.meters * usage.costPerMeter;
}

// ── Bulk (fiber / packaging / extras) ─────────────────────────────────────

export function bulkLineCost(usage: ProductBulkUsage): number {
  const kg = usage.grams / 1000;
  return kg * usage.costPerKg;
}

// ── Aggregate ─────────────────────────────────────────────────────────────

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export type ProductCostInputWithComposition = ProductCostInput & {
  /** Pre-computed cost from sub-products (resolved server-side). */
  compositionCost?: number;
};

export function calculateProductCost(
  input: ProductCostInputWithComposition,
): ProductCostBreakdown {
  const spongeCost = sum(input.sponges.map(spongeCostForProduct));
  const fabricCost = sum(input.fabrics.map(fabricLineCost));
  const fiberCost = sum(input.fibers.map(bulkLineCost));
  const packagingCost = sum(input.packaging.map(bulkLineCost));
  const extrasCost = sum((input.extras ?? []).map(bulkLineCost));
  const pocketCoilCost = sum(
    (input.pocketCoils ?? []).map((p) => p.quantity * p.costPerUnit),
  );
  const manufacturingCost = sum(input.manufacturing.map((m) => m.amount));
  const compositionCost = input.compositionCost ?? 0;

  const totalCost =
    spongeCost +
    fabricCost +
    fiberCost +
    packagingCost +
    extrasCost +
    pocketCoilCost +
    manufacturingCost +
    compositionCost;

  const retailPrice = input.retailPrice ?? 0;
  const wholesalePrice = input.wholesalePrice ?? 0;

  const retailProfit = retailPrice - totalCost;
  const wholesaleProfit = wholesalePrice - totalCost;

  return {
    spongeCost: round(spongeCost),
    fabricCost: round(fabricCost),
    fiberCost: round(fiberCost),
    packagingCost: round(packagingCost),
    extrasCost: round(extrasCost),
    pocketCoilCost: round(pocketCoilCost),
    manufacturingCost: round(manufacturingCost),
    compositionCost: round(compositionCost),
    totalCost: round(totalCost),
    retailPrice: round(retailPrice),
    wholesalePrice: round(wholesalePrice),
    retailProfit: round(retailProfit),
    retailMarginPct: retailPrice > 0 ? round((retailProfit / retailPrice) * 100) : 0,
    wholesaleProfit: round(wholesaleProfit),
    wholesaleMarginPct:
      wholesalePrice > 0 ? round((wholesaleProfit / wholesalePrice) * 100) : 0,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Formatting ────────────────────────────────────────────────────────────

export const EGP = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

export const EGPDetailed = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 2,
});

export function formatLE(amount: number, detailed = false): string {
  return (detailed ? EGPDetailed : EGP).format(amount);
}
