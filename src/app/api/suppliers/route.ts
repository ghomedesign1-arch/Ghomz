import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supplierInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET() {
  return NextResponse.json(
    await prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  );
}

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = supplierInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const data = { ...parsed.data, email: parsed.data.email || undefined };
  const created = await prisma.supplier.create({ data });
  return NextResponse.json(created, { status: 201 });
});
