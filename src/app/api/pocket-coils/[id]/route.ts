import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pocketCoilInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const coil = await prisma.pocketCoil.findUnique({
    where: { id: params.id },
    include: { supplier: true },
  });
  if (!coil) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(coil);
}

export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = pocketCoilInput.partial().safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const data = parsed.data;
  const updated = await prisma.pocketCoil.update({
    where: { id: params.id },
    data: {
      ...data,
      ...(data.supplierId !== undefined
        ? { supplierId: data.supplierId || null }
        : {}),
    },
  });
  return NextResponse.json(updated);
});

export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN");

  // Wipe BOM links first so we don't violate FK constraints on products that
  // reference this coil.
  await prisma.$transaction([
    prisma.productPocketCoil.deleteMany({ where: { pocketCoilId: params.id } }),
    prisma.pocketCoil.delete({ where: { id: params.id } }),
  ]);
  return new NextResponse(null, { status: 204 });
});
