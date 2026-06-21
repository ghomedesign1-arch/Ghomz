import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

const bodySchema = z.object({ done: z.boolean() });

/**
 * POST /api/cutting-lists/[id]/done — toggle the "cut complete" flag.
 *
 * When flipped on, records who marked it done and when so the catalogue
 * page can show "Done by <name> · 14 Jun". Flipping back off clears both.
 */
export const POST = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const { session } = await requireRole("ADMIN", "MANAGER", "PRODUCTION");

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) throw new HttpError(422, "Body must be { done: boolean }");

  const list = await prisma.cuttingList.findUnique({ where: { id: params.id } });
  if (!list) throw new HttpError(404, "Cutting list not found");

  const updated = await prisma.cuttingList.update({
    where: { id: params.id },
    data: parsed.data.done
      ? { done: true, doneAt: new Date(), doneById: session.user?.id ?? null }
      : { done: false, doneAt: null, doneById: null },
    include: { doneBy: { select: { name: true } } },
  });

  return NextResponse.json(updated);
});
