import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import {
  clearBrandLogoUrl,
  getBrandLogoUrl,
  setBrandLogoUrl,
} from "@/lib/brand";
import { deleteByUrl, uploadBuffer } from "@/lib/cloudinary";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ACCEPTED_MIME = new Set([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

/**
 * GET /api/brand/logo — { url: string | null }
 */
export const GET = withApi(async () => {
  const url = await getBrandLogoUrl();
  return NextResponse.json({ url });
});

/**
 * POST /api/brand/logo — multipart upload, single image.
 *
 * Uploaded to Cloudinary under `brand/logo` with `overwrite: true` so the
 * publicId stays stable and old generations are replaced atomically. We
 * still keep a Setting row with the resolved secure URL so the layout can
 * read it without hitting Cloudinary's API on every render.
 */
export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new HttpError(422, "No file provided");
  }
  if (file.size > MAX_BYTES) {
    throw new HttpError(413, `Logo too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
  }
  if (!ACCEPTED_MIME.has(file.type)) {
    throw new HttpError(
      415,
      `Unsupported logo type "${file.type}". Use SVG, PNG, JPG or WEBP.`,
    );
  }

  // Drop the previous Cloudinary asset (if any) so we don't accumulate
  // orphans when the publicId pattern changes between uploads.
  const previous = await getBrandLogoUrl();
  if (previous) await deleteByUrl(previous);

  const uploaded = await uploadBuffer(
    Buffer.from(await file.arrayBuffer()),
    {
      folder: "brand",
      publicId: "brand/logo",
      resourceType: "image",
      overwrite: true,
    },
  );

  await setBrandLogoUrl(uploaded.url);
  return NextResponse.json({ url: uploaded.url });
});

export const DELETE = withApi(async () => {
  await requireRole("ADMIN");
  const previous = await getBrandLogoUrl();
  if (previous) await deleteByUrl(previous);
  await clearBrandLogoUrl();
  return new NextResponse(null, { status: 204 });
});
