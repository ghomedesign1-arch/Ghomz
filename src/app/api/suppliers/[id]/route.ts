import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supplierInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
  });
  if (!supplier)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(supplier);
}

export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = supplierInput.partial().safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const data = {
    ...parsed.data,
    email: parsed.data.email === "" ? null : parsed.data.email,
  };
  const updated = await prisma.supplier.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(updated);
});

export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN");

  // Suppliers can be safely orphaned — sponges/fabrics keep functioning with
  // `supplierId = null`. We just null out the FK on each child row.
  await prisma.$transaction([
    prisma.sponge.updateMany({
      where: { supplierId: params.id },
      data: { supplierId: null },
    }),
    prisma.fabric.updateMany({
      where: { supplierId: params.id },
      data: { supplierId: null },
    }),
    prisma.purchase.deleteMany({ where: { supplierId: params.id } }),
    prisma.supplier.delete({ where: { id: params.id } }),
  ]);
  return new NextResponse(null, { status: 204 });
});
