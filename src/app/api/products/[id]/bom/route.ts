import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bomInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

/**
 * Replaces the full bill-of-materials for a product. Destructive — wipes
 * existing BOM rows + composition rows and writes the new set inside a
 * single transaction.
 *
 * BOM rows aren't FK-referenced by anything (the consumption ledger points
 * at the parent product and the upstream sponge / fabric / bulk records),
 * so the destructive approach is safe and much simpler than diffing.
 */
export const PUT = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = bomInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const productId = params.id;
  const {
    sponges,
    fabrics,
    bulkMaterials,
    manufacturing,
    compositions = [],
  } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new HttpError(404);

  // Reject self-reference and any composition path that would create a cycle.
  for (const c of compositions) {
    if (c.childProductId === productId) {
      throw new HttpError(422, "A product can't include itself");
    }
  }
  if (compositions.length > 0) {
    const cycle = await findCycle(productId, compositions.map((c) => c.childProductId));
    if (cycle) {
      throw new HttpError(
        422,
        `Composition would create a cycle through ${cycle.join(" → ")}`,
      );
    }
  }

  await prisma.$transaction([
    prisma.productSponge.deleteMany({ where: { productId } }),
    prisma.productFabric.deleteMany({ where: { productId } }),
    prisma.productBulkMaterial.deleteMany({ where: { productId } }),
    prisma.manufacturingCost.deleteMany({ where: { productId } }),
    prisma.productComposition.deleteMany({ where: { parentProductId: productId } }),
    prisma.productSponge.createMany({
      data: sponges.map((s) => ({ ...s, productId })),
    }),
    prisma.productFabric.createMany({
      data: fabrics.map((f) => ({ ...f, productId })),
    }),
    prisma.productBulkMaterial.createMany({
      data: bulkMaterials.map((b) => ({ ...b, productId })),
    }),
    prisma.manufacturingCost.createMany({
      data: manufacturing.map((m) => ({ ...m, productId })),
    }),
    prisma.productComposition.createMany({
      data: compositions.map((c) => ({
        parentProductId: productId,
        childProductId: c.childProductId,
        quantity: c.quantity,
        notes: c.notes,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true });
});

/**
 * BFS through the existing composition graph from each `childId` and return
 * the path back to `parentId` if one exists — that means inserting this
 * composition would create a cycle. Returns null if there's no cycle.
 */
async function findCycle(
  parentId: string,
  childIds: string[],
): Promise<string[] | null> {
  for (const child of childIds) {
    const visited = new Set<string>([parentId]);
    const stack: { id: string; path: string[] }[] = [
      { id: child, path: [child] },
    ];
    while (stack.length > 0) {
      const { id, path } = stack.pop()!;
      if (visited.has(id)) {
        if (id === parentId) return [parentId, ...path];
        continue;
      }
      visited.add(id);
      const next = await prisma.productComposition.findMany({
        where: { parentProductId: id },
        select: { childProductId: true },
      });
      for (const n of next) {
        if (n.childProductId === parentId) {
          return [parentId, ...path, n.childProductId];
        }
        stack.push({ id: n.childProductId, path: [...path, n.childProductId] });
      }
    }
  }
  return null;
}
