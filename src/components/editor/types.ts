export interface SpongeRef {
  id: string;
  name: string;
  density: number;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  pricePerDensity: number;
  wastePct: number;
}

export interface FabricRef {
  id: string;
  name: string;
  collection: string | null;
  color: string | null;
  costPerMeter: number;
}

export interface BulkRef {
  id: string;
  name: string;
  kind: "FIBER" | "PACKAGING" | "EXTRA";
  costPerKg: number;
}

export interface EditableProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  retailPrice: number;
  wholesalePrice: number;
  active: boolean;
  parentId: string | null;
  variantName: string | null;
  sponges: {
    spongeId: string;
    cutWidthCm: number;
    cutDepthCm: number;
    cutHeightCm: number;
    cuts: number;
    /** Manual yield override — null/undefined = auto-compute. */
    unitsPerBlockOverride: number | null;
    notes: string;
  }[];
  fabrics: { fabricId: string; meters: number }[];
  bulkMaterials: { bulkMaterialId: string; grams: number }[];
  manufacturing: {
    kind:
      | "LABOR"
      | "SEWING"
      | "COMPRESSION"
      | "PACKAGING_LABOR"
      | "TRANSPORT"
      | "FIXED_FEE"
      | "OTHER";
    label: string;
    amount: number;
  }[];
  /** Sub-products this product is composed of (a "set" / bundle). */
  compositions: {
    childProductId: string;
    quantity: number;
  }[];
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
}
