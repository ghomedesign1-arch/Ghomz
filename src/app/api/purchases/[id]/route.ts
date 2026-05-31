import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { purchaseInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export const GET = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const purchase = await prisma.purchase.findUnique({
    where: { id: params.id },
    include: { supplier: true, items: true },
  });
  if (!purchase) throw new HttpError(404, "Purchase not found");
  return NextResponse.json(purchase);
});

/**
 * PUT /api/purchases/[id] — replace the purchase header + line items.
 *
 * No inventory side-effects — purchases are a standalone log. Editing or
 * deleting a purchase only touches its own records.
 */
export const PUT = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = purchaseInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const {
    supplierId,
    reference,
    notes,
    items: newItems,
    purchaseDate,
  } = parsed.data;

  const existing = await prisma.purchase.findUnique({
    where: { id: params.id },
  });
  if (!existing) throw new HttpError(404, "Purchase not found");

  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new HttpError(404, "Supplier not found");
  }

  const totalAmount = newItems.reduce(
    (a, i) => a + i.quantity * i.unitCost,
    0,
  );

  const updated = await prisma.$transaction(async (tx) => {
    await tx.purchaseItem.deleteMany({ where: { purchaseId: params.id } });
    return tx.purchase.update({
      where: { id: params.id },
      data: {
        supplierId: supplierId ?? null,
        reference,
        notes,
        totalAmount,
        ...(purchaseDate ? { createdAt: new Date(purchaseDate) } : {}),
        items: {
          create: newItems.map((i) => ({
            kind: i.kind,
            itemName: i.itemName,
            itemDescription: i.itemDescription,
            quantity: i.quantity,
            unitCost: i.unitCost,
            totalCost: i.quantity * i.unitCost,
          })),
        },
      },
      include: { supplier: true, items: true },
    });
  });

  return NextResponse.json(updated);
});

/**
 * DELETE /api/purchases/[id] — remove the purchase and its line items.
 * No inventory reversal because the purchase never touched inventory.
 */
export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN");
  const purchase = await prisma.purchase.findUnique({
    where: { id: params.id },
  });
  if (!purchase) throw new HttpError(404, "Purchase not found");
  await prisma.purchase.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
});
