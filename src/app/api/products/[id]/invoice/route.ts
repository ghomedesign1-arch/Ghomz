import { NextResponse } from "next/server";
import { resolveProductCost } from "@/lib/product-cost";
import { renderInvoicePdf } from "@/lib/pdf/invoice";
import {
  cutVolumeCm3,
  spongeBlockCost,
  spongeBlockVolumeCm3,
} from "@/lib/costing";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { product, breakdown } = await resolveProductCost(params.id);

    const sponges = product.sponges.map((ps) => {
      const blockVol = spongeBlockVolumeCm3(ps.sponge);
      const cutVol = cutVolumeCm3({
        cutWidthCm: ps.cutWidthCm,
        cutDepthCm: ps.cutDepthCm,
        cutHeightCm: ps.cutHeightCm,
        cuts: ps.cuts,
      });
      const cost =
        (cutVol / blockVol) *
        spongeBlockCost(ps.sponge) *
        (1 / (1 - (ps.sponge.wastePct ?? 0) / 100));
      return {
        name: ps.sponge.name,
        description: `${ps.cutWidthCm}×${ps.cutDepthCm}×${ps.cutHeightCm} cm`,
        cost,
      };
    });

    const fabrics = product.fabrics.map((pf) => ({
      name: pf.fabric.name,
      description: `${pf.meters.toFixed(1)} m`,
      cost: pf.meters * pf.fabric.costPerMeter,
    }));

    const bulk = product.bulkMaterials.map((pb) => ({
      name: pb.bulkMaterial.name,
      description: `${pb.grams.toFixed(0)} g`,
      cost: (pb.grams / 1000) * pb.bulkMaterial.costPerKg,
    }));

    const manufacturing = product.manufacturing.map((m) => ({
      name: m.label,
      description: m.kind,
      cost: m.amount,
    }));

    const buffer = await renderInvoicePdf({
      product: {
        name: product.name,
        sku: product.sku,
        widthCm: product.widthCm,
        depthCm: product.depthCm,
        heightCm: product.heightCm,
        description: product.description,
      },
      breakdown,
      lines: { sponges, fabrics, bulk, manufacturing },
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${product.sku}-cost-statement.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}
