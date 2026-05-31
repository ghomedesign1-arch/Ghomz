import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi, requireRole } from "@/lib/rbac";

export const DELETE = withApi(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole("ADMIN", "MANAGER");

  const { id } = params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.customOrder.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
});

export const PATCH = withApi(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole("ADMIN", "MANAGER", "PRODUCTION");

  const { id } = params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json() as {
    status?: string;
    deposit?: number;
    notes?: string;
    clientName?: string;
    clientPhone?: string;
    clientAddress?: string;
    deliveryDate?: string | null;
  };

  const order = await prisma.customOrder.update({
    where: { id },
    data: {
      ...(body.status       !== undefined && { status: body.status }),
      ...(body.deposit      !== undefined && { deposit: body.deposit }),
      ...(body.notes        !== undefined && { notes: body.notes }),
      ...(body.clientName   !== undefined && { clientName: body.clientName }),
      ...(body.clientPhone  !== undefined && { clientPhone: body.clientPhone }),
      ...(body.clientAddress !== undefined && { clientAddress: body.clientAddress }),
      ...(body.deliveryDate !== undefined && {
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
      }),
    },
    include: { items: true },
  });

  return NextResponse.json(order);
});
