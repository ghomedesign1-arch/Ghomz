import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pocketCoilInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET() {
  return NextResponse.json(
    await prisma.pocketCoil.findMany({
      include: { supplier: true },
      orderBy: { name: "asc" },
    }),
  );
}

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = pocketCoilInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const data = parsed.data;
  const created = await prisma.pocketCoil.create({
    data: { ...data, supplierId: data.supplierId || null },
  });
  return NextResponse.json(created, { status: 201 });
});
