import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET() {
  return NextResponse.json(
    await prisma.bulkMaterial.findMany({ orderBy: { name: "asc" } }),
  );
}

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = bulkInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const created = await prisma.bulkMaterial.create({ data: parsed.data });
  return NextResponse.json(created, { status: 201 });
});
