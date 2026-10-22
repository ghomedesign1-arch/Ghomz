import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { getStockSummary } from "@/lib/semi-stock";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  await requireRole("ADMIN", "MANAGER", "PRODUCTION");
  return NextResponse.json(await getStockSummary());
});

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const body = (await req.json().catch(() => ({}))) as {
    model?: unknown;
    sizeCm?: unknown;
    initialQty?: unknown;
  };
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const sizeCm = Number(body.sizeCm);
  const initialQty = Number(body.initialQty ?? 0);
  if (!model) throw new HttpError(422, "Model name is required");
  if (!Number.isInteger(sizeCm) || sizeCm <= 0)
    throw new HttpError(422, "Size must be a whole number in cm");
  if (!Number.isInteger(initialQty))
    throw new HttpError(422, "Quantity must be a whole number");

  const exists = await prisma.semiStockItem.findUnique({
    where: { model_sizeCm: { model, sizeCm } },
  });
  if (exists) throw new HttpError(409, `${model} ${sizeCm} already exists`);

  const item = await prisma.semiStockItem.create({
    data: {
      model,
      sizeCm,
      movements:
        initialQty !== 0
          ? { create: { delta: initialQty, note: "Opening stock" } }
          : undefined,
    },
  });
  return NextResponse.json(item);
});
