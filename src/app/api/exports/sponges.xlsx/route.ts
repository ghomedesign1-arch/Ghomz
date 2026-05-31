import { prisma } from "@/lib/prisma";
import { spongeBlockCost, spongeBlockVolumeCm3 } from "@/lib/costing";
import { buildWorkbook, xlsxResponse } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET() {
  const sponges = await prisma.sponge.findMany({
    include: { supplier: true },
    orderBy: { name: "asc" },
  });

  const rows = sponges.map((s) => ({
    Name: s.name,
    Color: s.color,
    Hardness: s.hardness,
    Density: s.density,
    "W (cm)": s.widthCm,
    "D (cm)": s.depthCm,
    "H (cm)": s.heightCm,
    "Volume (cm³)": spongeBlockVolumeCm3(s),
    "Price/density": s.pricePerDensity,
    "Waste %": s.wastePct,
    "Unit cost (LE)": spongeBlockCost(s),
    "Stock blocks": s.stockBlocks,
    "Stock value (LE)": spongeBlockCost(s) * s.stockBlocks,
    Supplier: s.supplier?.name ?? "",
  }));

  const buf = buildWorkbook([{ name: "Sponges", rows }]);
  return xlsxResponse(buf, `g-homz-sponges-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
