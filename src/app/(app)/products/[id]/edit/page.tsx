import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canWrite } from "@/lib/rbac";
import { ProductEditor } from "@/components/editor/product-editor";
import { resolveProductCost } from "@/lib/product-cost";

export const dynamic = "force-dynamic";

const productInclude = {
  sponges: { include: { sponge: true } },
  fabrics: { include: { fabric: true } },
  bulkMaterials: { include: { bulkMaterial: true } },
  manufacturing: true,
  compositions: true,
} as const;

async function loadProductForEdit(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
}

type LoadedProduct = NonNullable<Awaited<ReturnType<typeof loadProductForEdit>>>;

interface PageProps {
  params: { id: string };
}

export default async function ProductEditPage({ params }: PageProps) {
  const writeAccess = await canWrite();
  if (!writeAccess) redirect(`/products/${params.id}`);

  const [product, sponges, fabrics, bulkMaterials, allProducts] =
    await Promise.all([
      loadProductForEdit(params.id),
      prisma.sponge.findMany({ orderBy: { name: "asc" } }),
      prisma.fabric.findMany({ orderBy: { name: "asc" } }),
      prisma.bulkMaterial.findMany({ orderBy: { name: "asc" } }),
      prisma.product.findMany({
        select: { id: true, name: true, sku: true },
        orderBy: { name: "asc" },
      }),
    ]);

  if (!product) notFound();

  // Resolve each candidate child product's current cost so the editor's live
  // cost preview can show composition cost without recomputing recursively
  // on every keystroke.
  const otherProducts = allProducts.filter((p) => p.id !== params.id);
  const productCosts: Record<string, number> = {};
  for (const op of otherProducts) {
    try {
      const { breakdown } = await resolveProductCost(op.id);
      productCosts[op.id] = breakdown.totalCost;
    } catch {
      productCosts[op.id] = 0;
    }
  }

  return (
    <ProductEditor
      product={serializeProduct(product)}
      sponges={sponges.map((s) => ({
        id: s.id,
        name: s.name,
        density: s.density,
        widthCm: s.widthCm,
        depthCm: s.depthCm,
        heightCm: s.heightCm,
        pricePerDensity: s.pricePerDensity,
        wastePct: s.wastePct,
      }))}
      fabrics={fabrics.map((f) => ({
        id: f.id,
        name: f.name,
        collection: f.collection,
        color: f.color,
        costPerMeter: f.costPerMeter,
      }))}
      bulkMaterials={bulkMaterials.map((b) => ({
        id: b.id,
        name: b.name,
        kind: b.kind,
        costPerKg: b.costPerKg,
      }))}
      otherProducts={otherProducts}
      productCosts={productCosts}
    />
  );
}

function serializeProduct(p: LoadedProduct) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    description: p.description ?? "",
    widthCm: p.widthCm,
    depthCm: p.depthCm,
    heightCm: p.heightCm,
    retailPrice: p.retailPrice,
    wholesalePrice: p.wholesalePrice,
    active: p.active,
    parentId: p.parentId ?? null,
    variantName: p.variantName ?? null,
    sponges: p.sponges.map((ps) => ({
      spongeId: ps.spongeId,
      cutWidthCm: ps.cutWidthCm,
      cutDepthCm: ps.cutDepthCm,
      cutHeightCm: ps.cutHeightCm,
      cuts: ps.cuts,
      unitsPerBlockOverride: ps.unitsPerBlockOverride ?? null,
      notes: ps.notes ?? "",
    })),
    fabrics: p.fabrics.map((pf) => ({
      fabricId: pf.fabricId,
      meters: pf.meters,
    })),
    bulkMaterials: p.bulkMaterials.map((pb) => ({
      bulkMaterialId: pb.bulkMaterialId,
      grams: pb.grams,
    })),
    manufacturing: p.manufacturing.map((m) => ({
      kind: m.kind,
      label: m.label,
      amount: m.amount,
    })),
    compositions: p.compositions.map((c) => ({
      childProductId: c.childProductId,
      quantity: c.quantity,
    })),
  };
}
