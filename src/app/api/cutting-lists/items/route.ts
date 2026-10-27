import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new HttpError(422, "Name is required");
  const clash = await prisma.cuttingListItem.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) throw new HttpError(409, `"${name}" already exists`);
  const item = await prisma.cuttingListItem.create({ data: { name } });
  return NextResponse.json(item, { status: 201 });
});
