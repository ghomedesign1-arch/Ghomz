import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { resourceKindFor, uploadBuffer } from "@/lib/cloudinary";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  // AutoCAD — browsers / OSes report several different MIME types for these.
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

/** Filename extensions accepted when the browser sends `application/octet-stream`
 *  (or no MIME type at all). DWG/DXF are the common cases. */
const ACCEPTED_EXTS = new Set(["dwg", "dxf"]);

export const GET = withApi(async (req: NextRequest) => {
  const productId = new URL(req.url).searchParams.get("productId");
  const where = productId ? { productId } : {};
  const lists = await prisma.cuttingList.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, sku: true } },
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(lists);
});

/**
 * POST /api/cutting-lists — multipart upload of a PDF/image cutting list.
 *
 * Files land under `public/uploads/cutting-lists/{productId}/{uuid}.{ext}` so
 * Next.js serves them as static assets via `/uploads/...`. Stored size /
 * mime type are recorded on the DB row for display + safety checks.
 */
export const POST = withApi(async (req: NextRequest) => {
  const { session } = await requireRole("ADMIN", "MANAGER");

  const form = await req.formData();
  const file = form.get("file");
  const thumbnail = form.get("thumbnail");
  const productId = String(form.get("productId") ?? "");
  const title = stringOrUndefined(form.get("title"));
  const notes = stringOrUndefined(form.get("notes"));

  if (!(file instanceof File)) {
    throw new HttpError(422, "No file provided");
  }
  if (!productId) {
    throw new HttpError(422, "productId is required");
  }
  if (file.size > MAX_BYTES) {
    throw new HttpError(413, `File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
  }
  // Some browsers / OSes don't have a registered MIME for DWG/DXF and fall
  // back to `application/octet-stream` (or an empty string). Accept those when
  // the filename extension matches one of the CAD formats we expect.
  const ext = safeExt(file.name);
  const extOk = ext !== null && ACCEPTED_EXTS.has(ext);
  const typeOk = ACCEPTED_TYPES.has(file.type);
  if (!typeOk && !extOk) {
    throw new HttpError(
      415,
      `Unsupported file "${file.name}" (${file.type || "no MIME type"}). Use PDF, image, or AutoCAD DWG/DXF.`,
    );
  }
  if (thumbnail instanceof File && thumbnail.size > 0) {
    if (!thumbnail.type.startsWith("image/")) {
      throw new HttpError(415, "Thumbnail must be an image (PNG / JPG / WEBP / GIF)");
    }
    if (thumbnail.size > MAX_BYTES) {
      throw new HttpError(413, "Thumbnail is too large");
    }
  }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new HttpError(404, "Product not found");

  // ── Main file → Cloudinary ────────────────────────────────────────────
  // DWG / DXF / PDF go up as `raw` so Cloudinary returns the original bytes
  // on download. Images go as `image` so transformations stay available.
  const folder = `cutting-lists/${productId}`;
  const mainResource = resourceKindFor(file.type);
  // PDFs share their binary signature with Adobe Illustrator; pin the format
  // so Cloudinary stores them as .pdf and serves Content-Type: application/pdf.
  const mainFormat = file.type === "application/pdf" ? "pdf" : undefined;
  const mainUpload = await uploadBuffer(Buffer.from(await file.arrayBuffer()), {
    folder,
    resourceType: mainResource,
    format: mainFormat,
  });

  let thumbnailPath: string | undefined;
  let thumbnailType: string | undefined;
  if (thumbnail instanceof File && thumbnail.size > 0) {
    const thumbUpload = await uploadBuffer(
      Buffer.from(await thumbnail.arrayBuffer()),
      { folder: `${folder}/cover`, resourceType: "image" },
    );
    thumbnailPath = thumbUpload.url;
    thumbnailType = thumbnail.type;
  }

  const created = await prisma.cuttingList.create({
    data: {
      productId,
      fileName: file.name,
      filePath: mainUpload.url,
      fileType: file.type,
      fileSize: file.size,
      thumbnailPath,
      thumbnailType,
      title,
      notes,
      uploadedById: session.user?.id,
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      uploadedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(created, { status: 201 });
});

function stringOrUndefined(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function safeExt(name: string): string | null {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : null;
}

function extFromMime(mime: string): string | null {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
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
    default:
      return null;
  }
}
