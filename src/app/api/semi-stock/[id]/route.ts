import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

/** POST { delta, note? } — manual stock adjustment (+ factory batch, − damage). */
export const POST = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER", "PRODUCTION");
  const body = (await req.json().catch(() => ({}))) as { delta?: unknown; note?: unknown };
  const delta = Number(body.delta);
  if (!Number.isInteger(delta) || delta === 0)
    throw new HttpError(422, "Enter a whole number other than 0");
  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  const movement = await prisma.semiStockMovement.create({
    data: { itemId: params.id, delta, note },
  });
  return NextResponse.json(movement);
});

/** PATCH { lowStockAt } */
export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const body = (await req.json().catch(() => ({}))) as { lowStockAt?: unknown };
  const lowStockAt = Number(body.lowStockAt);
  if (!Number.isInteger(lowStockAt) || lowStockAt < 0)
    throw new HttpError(422, "Low-stock level must be 0 or more");
  const item = await prisma.semiStockItem.update({
    where: { id: params.id },
    data: { lowStockAt },
  });
  return NextResponse.json(item);
});

export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN");
  await prisma.semiStockItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
});
