import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

/** PATCH { name } — rename. */
export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new HttpError(422, "Name is required");
  const clash = await prisma.cuttingListCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, id: { not: params.id } },
    select: { id: true },
  });
  if (clash) throw new HttpError(409, `"${name}" already exists`);
  const cat = await prisma.cuttingListCategory.update({
    where: { id: params.id },
    data: { name },
  });
  return NextResponse.json(cat);
});

/** DELETE — items in it become uncategorised (their files are kept). */
export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  await prisma.cuttingListCategory.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
});
