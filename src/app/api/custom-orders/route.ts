import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi, requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Generate next invoice number: GH-001, GH-002, … */
async function nextInvoiceNo(): Promise<string> {
  const last = await prisma.customOrder.findFirst({
    orderBy: { invoiceNo: "desc" },
    select: { invoiceNo: true },
  });
  if (!last) return "GH-001";
  const num = parseInt(last.invoiceNo.replace("GH-", ""), 10);
  return `GH-${String((isNaN(num) ? 0 : num) + 1).padStart(3, "0")}`;
}

export const GET = withApi(async () => {
  const orders = await prisma.customOrder.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(orders);
});

export const POST = withApi(async (req: NextRequest) => {
  const { session } = await requireRole("ADMIN", "MANAGER", "PRODUCTION");

  const body = await req.json() as {
    clientName: string;
    clientPhone?: string;
    clientAddress?: string;
    deliveryDate?: string;
    deposit?: number;
    notes?: string;
    status?: string;
    items: { name: string; description?: string; quantity: number; unitPrice: number; unitCost?: number }[];
  };

  const {
    clientName,
    clientPhone,
    clientAddress,
    deliveryDate,
    deposit,
    notes,
    status = "PENDING",
    items,
  } = body;

  if (!clientName?.trim()) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }
  if (!items?.length) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }

  const invoiceNo = await nextInvoiceNo();
  const order = await prisma.customOrder.create({
    data: {
      invoiceNo,
      clientName: clientName.trim(),
      clientPhone: clientPhone?.trim() || null,
      clientAddress: clientAddress?.trim() || null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      deposit: deposit ?? 0,
      notes: notes?.trim() || null,
      status,
      createdById: session.user?.id ?? null,
      items: {
        create: items.map((it) => ({
          name: it.name.trim(),
          description: it.description?.trim() || null,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          unitCost: it.unitCost ?? 0,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(order, { status: 201 });
});
