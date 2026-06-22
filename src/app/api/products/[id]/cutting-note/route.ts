import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

const bodySchema = z.object({
  note: z.string().max(2000).nullable(),
});

/**
 * PATCH /api/products/[id]/cutting-note — update the per-product note shown
 * on the cutting-lists page. Send { note: string } to set, { note: null } or
 * an empty string to clear.
 */
export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER", "PRODUCTION");

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) throw new HttpError(422, "Body must be { note: string | null }");

  const trimmed = parsed.data.note?.trim();
  const value = trimmed && trimmed.length > 0 ? trimmed : null;

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: { cuttingNote: value },
    select: { id: true, cuttingNote: true },
  });

  return NextResponse.json(updated);
});
