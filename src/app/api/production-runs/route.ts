import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productionRunInput } from "@/lib/validators";
import { resolveProductCost } from "@/lib/product-cost";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export const GET = withApi(async () => {
  const logs = await prisma.productionLog.findMany({
    include: { product: true, operator: true },
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  return NextResponse.json(logs);
});

/**
 * POST /api/production-runs
 *
 * Creates a production order ticket. Inventory deduction is intentionally
 * skipped until stock data is fully set up — the run is saved with status
 * IN_PROGRESS and cost is snapshotted from the BOM at creation time.
 */
export const POST = withApi(async (req: NextRequest) => {
  const { session } = await requireRole("ADMIN", "MANAGER", "PRODUCTION");
  const parsed = productionRunInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }

  const {
    productId, quantity, notes,
    clientName, clientPhone, clientAddress,
    deposit, startDate, deliveryDate, priority,
    status,
    unitCost: submittedUnitCost,
    totalCost: submittedTotalCost,
    discount: submittedDiscount,
  } = parsed.data;

  // Always resolve BOM cost for reference.
  // totalCost = base selling price (before discount); discount tracked separately.
  const { breakdown } = await resolveProductCost(productId);
  const bomUnitCost  = breakdown.totalCost;
  const savedUnitCost  = submittedUnitCost  ?? bomUnitCost;
  // totalCost stores the BASE price (no discount baked in)
  const savedTotalCost = submittedTotalCost ?? savedUnitCost * quantity;
  const savedDiscount  = submittedDiscount ?? 0;

  const log = await prisma.productionLog.create({
    data: {
      productId,
      quantity,
      status: status ?? "IN_PROGRESS",
      startedAt: startDate ? new Date(startDate) : new Date(),
      // Honor the unit cost the user actually picked (e.g. with a fabric
      // override applied). Falls back to the BOM default when not supplied.
      unitCost: savedUnitCost,
      totalCost: savedTotalCost,
      discount: savedDiscount,
      notes,
      operatorId: session.user?.id,
      clientName,
      clientPhone,
      clientAddress,
      deposit,
      startDate: startDate ? new Date(startDate) : undefined,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      priority: priority ?? "NORMAL",
    },
    include: { product: true },
  });

  return NextResponse.json(log, { status: 201 });
});
