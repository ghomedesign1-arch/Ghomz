import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fabricInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const fabric = await prisma.fabric.findUnique({
    where: { id: params.id },
    include: { supplier: true },
  });
  if (!fabric) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(fabric);
}

export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = fabricInput.partial().safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const updated = await prisma.fabric.update({
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

  const consumed = await prisma.fabricConsumption.count({
    where: { fabricId: params.id },
  });
  if (consumed > 0) {
    throw new HttpError(
      409,
      `Cannot delete: this fabric has ${consumed} production consumption record(s).`,
    );
  }

  await prisma.$transaction([
    prisma.productFabric.deleteMany({ where: { fabricId: params.id } }),
    prisma.fabric.delete({ where: { id: params.id } }),
  ]);
  return new NextResponse(null, { status: 204 });
});
