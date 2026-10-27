import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

/** POST { name } — new category goes to the end of the order. */
export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new HttpError(422, "Name is required");
  const clash = await prisma.cuttingListCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) throw new HttpError(409, `"${name}" already exists`);
  const last = await prisma.cuttingListCategory.aggregate({ _max: { position: true } });
  const cat = await prisma.cuttingListCategory.create({
    data: { name, position: (last._max.position ?? -1) + 1 },
  });
  return NextResponse.json(cat, { status: 201 });
});

/** PUT { ids: string[] } — save the full display order. */
export const PUT = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  if (!Array.isArray(body.ids) || !body.ids.every((x) => typeof x === "string"))
    throw new HttpError(422, "ids must be a list of category ids");
  const ids = body.ids as string[];
  await prisma.$transaction(
    ids.map((id, position) =>
      prisma.cuttingListCategory.update({ where: { id }, data: { position } }),
    ),
  );
  return NextResponse.json({ ok: true });
});
