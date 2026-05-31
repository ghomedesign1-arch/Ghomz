import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productPatchInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      sponges: { include: { sponge: true } },
      fabrics: { include: { fabric: true } },
      bulkMaterials: { include: { bulkMaterial: true } },
      manufacturing: true,
    },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = productPatchInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const updated = await prisma.product.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json(updated);
});

export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN");

  // BOM lines, sponge yields and manufacturing entries cascade automatically
  // (defined onDelete: Cascade in the schema). Production logs do NOT cascade
  // from Product, so we delete them explicitly here — their consumption
  // ledger rows then cascade off ProductionLog automatically.
  await prisma.$transaction([
    prisma.productionLog.deleteMany({ where: { productId: params.id } }),
    prisma.product.delete({ where: { id: params.id } }),
  ]);
  return new NextResponse(null, { status: 204 });
});
