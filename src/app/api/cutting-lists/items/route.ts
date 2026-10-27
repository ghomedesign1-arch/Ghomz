import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    categoryId?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new HttpError(422, "Name is required");
  let categoryId: string | null = null;
  if (typeof body.categoryId === "string" && body.categoryId) {
    const cat = await prisma.cuttingListCategory.findUnique({
      where: { id: body.categoryId },
      select: { id: true },
    });
    if (!cat) throw new HttpError(404, "Category not found");
    categoryId = cat.id;
  }
  const clash = await prisma.cuttingListItem.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) throw new HttpError(409, `"${name}" already exists`);
  const item = await prisma.cuttingListItem.create({ data: { name, categoryId } });
  return NextResponse.json(item, { status: 201 });
});
