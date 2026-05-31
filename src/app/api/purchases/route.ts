import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { purchaseInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export const GET = withApi(async () => {
  const purchases = await prisma.purchase.findMany({
    include: {
      supplier: true,
      items: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(purchases);
});

/**
 * POST /api/purchases — record a restock from a supplier.
 *
 * Purchases are a standalone log: they do NOT bump inventory and do NOT link
 * to the sponge / fabric / bulk catalog. Each line item is just a free-form
 * record of what was bought (kind, itemName, itemDescription, qty, unitCost).
 */
export const POST = withApi(async (req: NextRequest) => {
  const { session } = await requireRole("ADMIN", "MANAGER");
  const parsed = purchaseInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const { supplierId, reference, notes, items, purchaseDate } = parsed.data;

  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new HttpError(404, "Supplier not found");
  }

  const totalAmount = items.reduce(
    (acc, i) => acc + i.quantity * i.unitCost,
    0,
  );

  const created = await prisma.purchase.create({
    data: {
      supplierId: supplierId ?? undefined,
      reference,
      notes,
      totalAmount,
      createdById: session.user?.id,
      ...(purchaseDate ? { createdAt: new Date(purchaseDate) } : {}),
      items: {
        create: items.map((i) => ({
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

  return NextResponse.json(created, { status: 201 });
});
