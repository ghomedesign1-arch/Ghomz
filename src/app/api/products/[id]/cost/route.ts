import { NextResponse } from "next/server";
import { resolveProductCost } from "@/lib/product-cost";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { product, breakdown } = await resolveProductCost(params.id);
    return NextResponse.json({
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        retailPrice: product.retailPrice,
        wholesalePrice: product.wholesalePrice,
      },
      breakdown,
    });
  } catch {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}
