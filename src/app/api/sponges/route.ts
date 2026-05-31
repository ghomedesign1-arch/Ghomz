import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spongeInput } from "@/lib/validators";
import { spongeBlockCost } from "@/lib/costing";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET() {
  const sponges = await prisma.sponge.findMany({
    include: { supplier: true, yields: { include: { product: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(sponges);
}

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = spongeInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const { yields, ...data } = parsed.data;
  const unitCost = spongeBlockCost(data);
  const manufactureDate = data.manufactureDate
    ? new Date(data.manufactureDate)
    : null;

  // Create sponge + initial cutting plan (if any) in one transaction.
  const created = await prisma.$transaction(async (tx) => {
    const sponge = await tx.sponge.create({
      data: {
        ...data,
        unitCost,
        manufactureDate,
      },
    });
    if (yields && yields.length > 0) {
      await tx.spongeYield.createMany({
        data: yields.map((y) => ({
          spongeId: sponge.id,
          productId: y.productId,
          unitsPerBlock: y.unitsPerBlock,
        })),
      });
    }
    return tx.sponge.findUnique({
      where: { id: sponge.id },
      include: { yields: true },
    });
  });
  return NextResponse.json(created, { status: 201 });
});
