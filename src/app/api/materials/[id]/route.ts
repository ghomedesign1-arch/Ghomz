import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const bulk = await prisma.bulkMaterial.findUnique({
    where: { id: params.id },
  });
  if (!bulk) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bulk);
}

export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = bulkInput.partial().safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const updated = await prisma.bulkMaterial.update({
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

  const consumed = await prisma.bulkConsumption.count({
    where: { bulkMaterialId: params.id },
  });
  if (consumed > 0) {
    throw new HttpError(
      409,
      `Cannot delete: this material has ${consumed} production consumption record(s).`,
    );
  }

  await prisma.$transaction([
    prisma.productBulkMaterial.deleteMany({ where: { bulkMaterialId: params.id } }),
    prisma.bulkMaterial.delete({ where: { id: params.id } }),
  ]);
  return new NextResponse(null, { status: 204 });
});
