import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fabricInput } from "@/lib/validators";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export async function GET() {
  return NextResponse.json(
    await prisma.fabric.findMany({
      include: { supplier: true },
      orderBy: { name: "asc" },
    }),
  );
}

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const parsed = fabricInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const created = await prisma.fabric.create({ data: parsed.data });
  return NextResponse.json(created, { status: 201 });
});
