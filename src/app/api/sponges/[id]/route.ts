import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spongeInput } from "@/lib/validators";
import { spongeBlockCost } from "@/lib/costing";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sponge = await prisma.sponge.findUnique({
    where: { id: params.id },
    include: { supplier: true, yields: { include: { product: true } } },
  });
  if (!sponge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sponge);
}

export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = spongeInput.partial().safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const current = await prisma.sponge.findUnique({ where: { id: params.id } });
  if (!current) throw new HttpError(404);

  const { yields, ...patch } = parsed.data;
  const next = { ...current, ...patch };
  const unitCost = spongeBlockCost(next);

  const manufactureDate =
    "manufactureDate" in patch
      ? patch.manufactureDate
        ? new Date(patch.manufactureDate)
        : null
      : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const sponge = await tx.sponge.update({
      where: { id: params.id },
      data: {
        ...patch,
        unitCost,
        ...(manufactureDate !== undefined ? { manufactureDate } : {}),
      },
    });
    // If the caller sent a `yields` array, replace the cutting plan
    // transactionally. Sending `undefined` leaves the plan untouched, so
    // partial PATCHes that don't care about yields keep working.
    if (yields !== undefined) {
      await tx.spongeYield.deleteMany({ where: { spongeId: params.id } });
      if (yields.length > 0) {
        await tx.spongeYield.createMany({
          data: yields.map((y) => ({
            spongeId: params.id,
            productId: y.productId,
            unitsPerBlock: y.unitsPerBlock,
          })),
        });
      }
    }
    return sponge;
  });

  return NextResponse.json(updated);
});

export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN");
  await prisma.sponge.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
});
