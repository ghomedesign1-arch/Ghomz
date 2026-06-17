import { prisma } from "@/lib/prisma";
import { resolveProductCost } from "@/lib/product-cost";
import { buildWorkbook, xlsxResponse } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  const summary = await Promise.all(
    products.map(async (p) => {
      const { breakdown } = await resolveProductCost(p.id);
      return {
        SKU: p.sku,
        Name: p.name,
        Category: p.category,
        "W (cm)": p.widthCm,
        "D (cm)": p.depthCm,
        "H (cm)": p.heightCm,
        "Stock qty": p.stockQty,
        "Sponge cost (LE)": breakdown.spongeCost,
        "Fabric cost (LE)": breakdown.fabricCost,
        "Fiber cost (LE)": breakdown.fiberCost,
        "Packaging cost (LE)": breakdown.packagingCost,
        "Pocket coil cost (LE)": breakdown.pocketCoilCost,
        "Manufacturing (LE)": breakdown.manufacturingCost,
        "Total cost (LE)": breakdown.totalCost,
        "Retail price (LE)": breakdown.retailPrice,
        "Retail profit (LE)": breakdown.retailProfit,
        "Retail margin %": breakdown.retailMarginPct,
        "Wholesale price (LE)": breakdown.wholesalePrice,
        "Wholesale margin %": breakdown.wholesaleMarginPct,
      };
    }),
  );

  const buf = buildWorkbook([{ name: "Products", rows: summary }]);
  return xlsxResponse(buf, `g-homz-products-${today()}.xlsx`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
