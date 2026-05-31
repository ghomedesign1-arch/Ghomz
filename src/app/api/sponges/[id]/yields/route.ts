import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spongeYieldsInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

/**
 * GET /api/sponges/[id]/yields — list the cutting plan for one sponge block.
 */
export const GET = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const yields = await prisma.spongeYield.findMany({
    where: { spongeId: params.id },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(yields);
});

/**
 * PUT /api/sponges/[id]/yields — replace the full cutting plan.
 *
 * Transactionally deletes existing yields and writes the new set. We use a
 * destructive-replace because the plan is small and edits are infrequent.
 */
export const PUT = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = spongeYieldsInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const spongeId = params.id;

  const sponge = await prisma.sponge.findUnique({ where: { id: spongeId } });
  if (!sponge) throw new HttpError(404, "Sponge not found");

  // Verify every product exists before touching the DB.
  for (const y of parsed.data.yields) {
    const ok = await prisma.product.findUnique({
      where: { id: y.productId },
      select: { id: true },
    });
    if (!ok) {
      throw new HttpError(422, `Product not found: ${y.productId}`);
    }
  }

  await prisma.$transaction([
    prisma.spongeYield.deleteMany({ where: { spongeId } }),
    prisma.spongeYield.createMany({
      data: parsed.data.yields.map((y) => ({
        spongeId,
        productId: y.productId,
        unitsPerBlock: y.unitsPerBlock,
        notes: y.notes,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true });
});
