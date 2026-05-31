import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import {
  deleteByUrl,
  isCloudinaryUrl,
  resourceKindFor,
  uploadBuffer,
} from "@/lib/cloudinary";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/acad",
  "application/autocad_dwg",
  "image/x-dwg",
  "image/vnd.dwg",
  "application/dwg",
  "application/x-dwg",
  "application/dxf",
  "image/vnd.dxf",
  "application/x-autocad",
]);
const ACCEPTED_EXTS = new Set(["dwg", "dxf"]);

/**
 * PATCH /api/cutting-lists/[id] — edit metadata, optionally swap the file
 * and/or cover image. Send as multipart/form-data so the file payloads stream
 * cleanly. Any field that isn't sent (or is an empty File) is left untouched.
 *
 * Fields accepted:
 *   - title           string | "" to clear
 *   - notes           string | "" to clear
 *   - file            File   — replaces the main file; old one is removed
 *   - thumbnail       File   — replaces the cover; old cover is removed
 *   - removeThumbnail "1"    — drop the existing cover without uploading a new one
 */
export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const list = await prisma.cuttingList.findUnique({ where: { id: params.id } });
  if (!list) throw new HttpError(404, "Cutting list not found");

  const form = await req.formData();
  const title = form.get("title");
  const notes = form.get("notes");
  const fileEntry = form.get("file");
  const thumbnailEntry = form.get("thumbnail");
  const removeThumbnail = form.get("removeThumbnail") === "1";

  const folder = `cutting-lists/${list.productId}`;

  // ── Main file replacement ───────────────────────────────────────────────
  let newFilePath: string | undefined;
  let newFileName: string | undefined;
  let newFileType: string | undefined;
  let newFileSize: number | undefined;

  if (fileEntry instanceof File && fileEntry.size > 0) {
    if (fileEntry.size > MAX_BYTES) {
      throw new HttpError(413, `File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
    }
    const ext = safeExt(fileEntry.name);
    const extOk = ext !== null && ACCEPTED_EXTS.has(ext);
    if (!ACCEPTED_TYPES.has(fileEntry.type) && !extOk) {
      throw new HttpError(
        415,
        `Unsupported file "${fileEntry.name}" (${fileEntry.type || "no MIME type"}). Use PDF, image, or AutoCAD DWG/DXF.`,
      );
    }
    const uploaded = await uploadBuffer(
      Buffer.from(await fileEntry.arrayBuffer()),
      { folder, resourceType: resourceKindFor(fileEntry.type) },
    );
    newFilePath = uploaded.url;
    newFileName = fileEntry.name;
    newFileType = fileEntry.type || (ext === "dwg" ? "application/acad" : "application/octet-stream");
    newFileSize = fileEntry.size;

    // Clean up the previous asset. If it lived on disk (legacy /uploads/...)
    // we unlink locally; if it lived on Cloudinary we destroy by URL.
    await removePrevious(list.filePath);
  }

  // ── Cover image replacement / removal ───────────────────────────────────
  let newThumbnailPath: string | null | undefined;
  let newThumbnailType: string | null | undefined;

  if (thumbnailEntry instanceof File && thumbnailEntry.size > 0) {
    if (!thumbnailEntry.type.startsWith("image/")) {
      throw new HttpError(415, "Cover must be an image (PNG / JPG / WEBP / GIF)");
    }
    if (thumbnailEntry.size > MAX_BYTES) {
      throw new HttpError(413, "Cover image is too large");
    }
    const uploaded = await uploadBuffer(
      Buffer.from(await thumbnailEntry.arrayBuffer()),
      { folder: `${folder}/cover`, resourceType: "image" },
    );
    newThumbnailPath = uploaded.url;
    newThumbnailType = thumbnailEntry.type;
    await removePrevious(list.thumbnailPath);
  } else if (removeThumbnail && list.thumbnailPath) {
    await removePrevious(list.thumbnailPath);
    newThumbnailPath = null;
    newThumbnailType = null;
  }

  const updated = await prisma.cuttingList.update({
    where: { id: params.id },
    data: {
      ...(typeof title === "string" ? { title: title.trim() || null } : {}),
      ...(typeof notes === "string" ? { notes: notes.trim() || null } : {}),
      ...(newFilePath  !== undefined && { filePath: newFilePath, fileName: newFileName, fileType: newFileType, fileSize: newFileSize }),
      ...(newThumbnailPath !== undefined && { thumbnailPath: newThumbnailPath, thumbnailType: newThumbnailType }),
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      uploadedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(updated);
});

export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const list = await prisma.cuttingList.findUnique({ where: { id: params.id } });
  if (!list) throw new HttpError(404, "Cutting list not found");

  for (const p of [list.filePath, list.thumbnailPath]) {
    await removePrevious(p);
  }

  await prisma.cuttingList.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
});

/**
 * Removes an asset given its stored path. Handles both schemes:
 *   - new uploads → full Cloudinary URL → `deleteByUrl`
 *   - legacy uploads → relative `/uploads/...` path → `fs.unlink`
 * Always best-effort; a missing file/asset is fine and never throws.
 */
async function removePrevious(stored: string | null | undefined): Promise<void> {
  if (!stored) return;
  if (isCloudinaryUrl(stored)) {
    await deleteByUrl(stored);
    return;
  }
  // Legacy filesystem path served from /public.
  try {
    await fs.unlink(path.join(process.cwd(), "public", stored));
  } catch {
    /* file already gone — fine */
  }
}

function safeExt(name: string): string | null {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : null;
}

function extFromMime(mime: string): string | null {
  switch (mime) {
    case "application/pdf": return "pdf";
    case "image/png":       return "png";
    case "image/jpeg":
    case "image/jpg":       return "jpg";
    case "image/webp":      return "webp";
    case "image/gif":       return "gif";
    case "application/acad":
    case "application/autocad_dwg":
    case "image/x-dwg":
    case "image/vnd.dwg":
    case "application/dwg":
    case "application/x-dwg":
    case "application/x-autocad":
      return "dwg";
    case "application/dxf":
    case "image/vnd.dxf":
      return "dxf";
    default: return null;
  }
}
