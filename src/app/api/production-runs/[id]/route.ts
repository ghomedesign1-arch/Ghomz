import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { z } from "zod";

const patchInput = z.object({
  quantity:     z.number().int().positive().optional(),
  status:       z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  priority:     z.enum(["NORMAL", "HIGH", "URGENT"]).optional(),
  notes:        z.string().optional().nullable(),
  clientName:   z.string().optional().nullable(),
  clientPhone:  z.string().optional().nullable(),
  clientAddress:z.string().optional().nullable(),
  deposit:      z.number().min(0).optional().nullable(),
  totalCost:    z.number().min(0).optional(),
  unitCost:     z.number().min(0).optional(),
  discount:     z.number().min(0).optional(),
  startDate:    z.string().datetime({ offset: true }).optional().nullable(),
  deliveryDate: z.string().datetime({ offset: true }).optional().nullable(),
});

/**
 * DELETE /api/production-runs/[id]
 *
 * Removes a single production run from the ledger. The associated
 * `SpongeConsumption` / `FabricConsumption` / `BulkConsumption` rows cascade
 * automatically (onDelete: Cascade in the schema).
 *
 * Note — this does NOT restore the inventory the run consumed. If you want
 * undo-with-restore semantics, build a separate "reverse run" action; deleting
 * a log is intended for cleaning up stale entries (e.g. seeded demo data).
 */
export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER", "PRODUCTION");
  const log = await prisma.productionLog.findUnique({ where: { id: params.id } });
  if (!log) throw new HttpError(404, "Production run not found");

  const parsed = patchInput.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(422, JSON.stringify(parsed.error.issues));

  const {
    quantity, status, priority, notes,
    clientName, clientPhone, clientAddress,
    deposit, totalCost, unitCost, discount, startDate, deliveryDate,
  } = parsed.data;

  // If totalCost is sent explicitly, always use it.
  // If only quantity changes (no totalCost sent), keep the existing per-unit ratio.
  const resolvedTotalCost = totalCost !== undefined
    ? totalCost
    : quantity !== undefined
      ? (log.totalCost / (log.quantity || 1)) * quantity   // scale by same unit price
      : undefined;

  const updated = await prisma.productionLog.update({
    where: { id: params.id },
    data: {
      ...(quantity              !== undefined && { quantity }),
      ...(resolvedTotalCost     !== undefined && { totalCost: resolvedTotalCost }),
      // Persist the per-unit cost the user computed (e.g. after switching
      // fabric in the dialog). Without this, the saved snapshot stays at
      // whatever the BOM said when the order was originally created.
      ...(unitCost              !== undefined && { unitCost }),
      ...(discount              !== undefined && { discount }),
      ...(status       !== undefined && { status }),
      ...(priority     !== undefined && { priority }),
      ...(notes        !== undefined && { notes }),
      ...(clientName   !== undefined && { clientName }),
      ...(clientPhone  !== undefined && { clientPhone }),
      ...(clientAddress !== undefined && { clientAddress }),
      ...(deposit      !== undefined && { deposit }),
      ...(startDate    !== undefined && { startDate: startDate ? new Date(startDate) : null, startedAt: startDate ? new Date(startDate) : log.startedAt }),
      ...(deliveryDate !== undefined && { deliveryDate: deliveryDate ? new Date(deliveryDate) : null }),
    },
    include: { product: true },
  });

  return NextResponse.json(updated);
});

export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN");
  const log = await prisma.productionLog.findUnique({ where: { id: params.id } });
  if (!log) throw new HttpError(404, "Production run not found");
  await prisma.productionLog.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
});
