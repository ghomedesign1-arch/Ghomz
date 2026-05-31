import { prisma } from "./prisma";
import { resolveProductCost } from "./product-cost";
import { unitsPerBlock } from "./costing";
import type { ProductionRunOption } from "@/components/dialogs/production-run-dialog";

export async function getProductionRunOptions(): Promise<ProductionRunOption[]> {
  let products: { id: string; sku: string; name: string }[] = [];
  try {
    products = await prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, sku: true, name: true },
    });
  } catch (e) {
    console.error("[production-options] DB read failed:", e);
    return [];
  }

  const results: ProductionRunOption[] = [];

  for (const p of products) {
    try {
      const { product, breakdown } = await resolveProductCost(p.id);
      const constraints: ProductionRunOption["constraints"] = [];

      for (const ps of product.sponges) {
        const cut = {
          cutWidthCm: ps.cutWidthCm,
          cutDepthCm: ps.cutDepthCm,
          cutHeightCm: ps.cutHeightCm,
          cuts: ps.cuts,
        };
        const unitsFit = unitsPerBlock({ block: ps.sponge, cuts: [cut] });
        constraints.push({
          label: `Sponge · ${ps.sponge.name}`,
          need: unitsFit > 0 ? `1 block / ${unitsFit} units` : "N/A",
          have: `${ps.sponge.stockBlocks} blocks`,
          ok: ps.sponge.stockBlocks >= 1,
        });
      }

      for (const pf of product.fabrics) {
        constraints.push({
          label: `Fabric · ${pf.fabric.name}`,
          need: `${pf.meters.toFixed(1)} m / unit`,
          have: `${pf.fabric.stockMeters.toFixed(1)} m`,
          ok: pf.fabric.stockMeters >= pf.meters,
        });
      }

      for (const pb of product.bulkMaterials) {
        constraints.push({
          label: `${pb.bulkMaterial.kind} · ${pb.bulkMaterial.name}`,
          need: `${pb.grams.toFixed(0)} g / unit`,
          have: `${pb.bulkMaterial.stockKg.toFixed(2)} kg`,
          ok: pb.bulkMaterial.stockKg * 1000 >= pb.grams,
        });
      }

      // Fabric cost breakdown — needed so dialog can swap fabric and recalculate
      const fabricLines = product.fabrics.map((pf) => ({
        fabricId:            pf.fabric.id,
        fabricName:          pf.fabric.name,
        meters:              pf.meters,
        defaultCostPerMeter: pf.fabric.costPerMeter,
      }));
      const fabricCostTotal = fabricLines.reduce(
        (a, fl) => a + fl.meters * fl.defaultCostPerMeter,
        0,
      );
      const nonFabricCost = breakdown.totalCost - fabricCostTotal;

      results.push({
        id: product.id,
        sku: product.sku,
        name: product.name,
        unitCost: breakdown.totalCost,
        retailPrice: breakdown.retailPrice,
        wholesalePrice: breakdown.wholesalePrice,
        maxFeasible: Number.MAX_SAFE_INTEGER,
        constraints,
        fabricLines,
        nonFabricCost,
      });
    } catch (e) {
      console.error(`[production-options] resolveProductCost failed for ${p.name}:`, e);
      results.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        unitCost: 0,
        retailPrice: 0,
        wholesalePrice: 0,
        maxFeasible: Number.MAX_SAFE_INTEGER,
        constraints: [],
        fabricLines: [],
        nonFabricCost: 0,
      });
    }
  }

  return results;
}
