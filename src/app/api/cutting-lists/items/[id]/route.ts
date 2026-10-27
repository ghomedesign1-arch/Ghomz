import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { deleteByUrl, isCloudinaryUrl } from "@/lib/cloudinary";

/** PATCH { name?, note? } — rename an item or set / clear its cutting note. */
export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    note?: unknown;
  };
  const data: { name?: string; note?: string | null } = {};

  if ("name" in body) {
    await requireRole("ADMIN", "MANAGER");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new HttpError(422, "Name is required");
    const clash = await prisma.cuttingListItem.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        id: { not: params.id },
      },
      select: { id: true },
    });
    if (clash) throw new HttpError(409, `"${name}" already exists`);
    data.name = name;
  }
  if ("note" in body) {
    await requireRole("ADMIN", "MANAGER", "PRODUCTION");
    if (body.note !== null && typeof body.note !== "string")
      throw new HttpError(422, "note must be a string or null");
    const trimmed = typeof body.note === "string" ? body.note.trim() : "";
    if (trimmed.length > 2000) throw new HttpError(422, "Note is too long");
    data.note = trimmed || null;
  }
  if (Object.keys(data).length === 0) throw new HttpError(422, "Nothing to update");

  const item = await prisma.cuttingListItem.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(item);
});

/** DELETE — removes the item, its files and their stored assets. */
export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const item = await prisma.cuttingListItem.findUnique({
    where: { id: params.id },
    include: { files: { select: { filePath: true, thumbnailPath: true } } },
  });
  if (!item) throw new HttpError(404, "Item not found");

  for (const f of item.files) {
    for (const stored of [f.filePath, f.thumbnailPath]) {
      if (!stored) continue;
      if (isCloudinaryUrl(stored)) {
        await deleteByUrl(stored);
      } else {
        await fs.unlink(path.join(process.cwd(), "public", stored)).catch(() => {});
      }
    }
  }
  await prisma.cuttingListItem.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
});
