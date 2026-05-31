import { prisma } from "./prisma";
import { resolveProductCost } from "./product-cost";

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  stockQty: number;
  retailPrice: number;
  wholesalePrice: number;
  unitCost: number;
  retailMarginPct: number;
  imageUrl: string | null;
  parentId: string | null;
  variantName: string | null;
  variantCount: number; // number of child variants (0 = standalone)
};

const DEMO_PRODUCTS: ProductListItem[] = [
  {
    id: "demo-1",
    sku: "GH-LSF-001",
    name: "Fluff L Shape Sofa",
    category: "L_SHAPE_SOFA",
    widthCm: 240,
    depthCm: 160,
    heightCm: 70,
    stockQty: 6,
    retailPrice: 18500,
    wholesalePrice: 14500,
    unitCost: 9600,
    retailMarginPct: 48.1,
    imageUrl: null,
    parentId: null,
    variantName: null,
    variantCount: 0,
  },
  {
    id: "demo-2",
    sku: "GH-CHR-001",
    name: "Fluff Chair",
    category: "CHAIR",
    widthCm: 90,
    depthCm: 90,
    heightCm: 70,
    stockQty: 14,
    retailPrice: 5400,
    wholesalePrice: 4100,
    unitCost: 2800,
    retailMarginPct: 48.2,
    imageUrl: null,
    parentId: null,
    variantName: null,
    variantCount: 0,
  },
  {
    id: "demo-3",
    sku: "GH-OTT-001",
    name: "Fluff Ottoman",
    category: "OTTOMAN",
    widthCm: 80,
    depthCm: 80,
    heightCm: 40,
    stockQty: 9,
    retailPrice: 2800,
    wholesalePrice: 2100,
    unitCost: 1450,
    retailMarginPct: 48.2,
    imageUrl: null,
    parentId: null,
    variantName: null,
    variantCount: 0,
  },
  {
    id: "demo-4",
    sku: "GH-BED-001",
    name: "Cloud Kids Bed",
    category: "BED",
    widthCm: 200,
    depthCm: 100,
    heightCm: 35,
    stockQty: 3,
    retailPrice: 9600,
    wholesalePrice: 7400,
    unitCost: 5100,
    retailMarginPct: 46.8,
    imageUrl: null,
    parentId: null,
    variantName: null,
    variantCount: 0,
  },
];

export async function getProducts(): Promise<{
  products: ProductListItem[];
  ready: boolean;
}> {
  try {
    const rows = await prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { variants: true } } },
    });
    const resolved = await Promise.all(
      rows.map(async (p) => {
        const { breakdown } = await resolveProductCost(p.id);
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          widthCm: p.widthCm,
          depthCm: p.depthCm,
          heightCm: p.heightCm,
          stockQty: p.stockQty,
          retailPrice: p.retailPrice,
          wholesalePrice: p.wholesalePrice,
          unitCost: breakdown.totalCost,
          retailMarginPct: breakdown.retailMarginPct,
          imageUrl: p.imageUrl ?? null,
          parentId: p.parentId ?? null,
          variantName: p.variantName ?? null,
          variantCount: p._count.variants,
        };
      }),
    );
    return { products: resolved, ready: true };
  } catch {
    return { products: DEMO_PRODUCTS, ready: false };
  }
}
