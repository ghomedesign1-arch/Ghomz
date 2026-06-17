import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { deleteByUrl, uploadBuffer } from "@/lib/cloudinary";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * POST /api/products/[id]/image — upload / replace the product hero image.
 *
 * Stored in Cloudinary under `products/<productId>` with a stable publicId
 * so the Vercel serverless filesystem (read-only outside /tmp) is never
 * touched. Any previous Cloudinary asset is deleted to avoid orphans.
 */
export const POST = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) throw new HttpError(404, "Product not found");

  const form = await req.formData();
  const file = form.get("image");

  if (!(file instanceof File)) throw new HttpError(422, "No image provided");
  if (file.size > MAX_BYTES) throw new HttpError(413, "Image too large (max 5 MB)");
  if (!ACCEPTED.has(file.type)) throw new HttpError(415, "Use JPEG, PNG, WEBP or GIF");

  // Remove old asset before re-uploading. Safe to call on legacy
  // /uploads/... paths — deleteByUrl no-ops when the URL isn't Cloudinary.
  if (product.imageUrl) {
    await deleteByUrl(product.imageUrl);
  }

  const uploaded = await uploadBuffer(
    Buffer.from(await file.arrayBuffer()),
    {
      folder: `products/${params.id}`,
      publicId: `products/${params.id}/hero`,
      resourceType: "image",
      overwrite: true,
    },
  );

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: { imageUrl: uploaded.url },
    select: { id: true, imageUrl: true },
  });

  return NextResponse.json(updated);
});

/**
 * DELETE /api/products/[id]/image — remove the hero image.
 */
export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) throw new HttpError(404, "Product not found");

  if (product.imageUrl) {
    await deleteByUrl(product.imageUrl);
    await prisma.product.update({ where: { id: params.id }, data: { imageUrl: null } });
  }

  return new NextResponse(null, { status: 204 });
});
