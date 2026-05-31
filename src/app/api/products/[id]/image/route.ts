import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * POST /api/products/[id]/image — upload / replace the product hero image.
 * File saved to public/uploads/products/{id}/{uuid}.{ext}
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

  const dir = path.join(process.cwd(), "public", "uploads", "products", params.id);
  await fs.mkdir(dir, { recursive: true });

  // Remove old image from disk if present
  if (product.imageUrl) {
    try {
      await fs.unlink(path.join(process.cwd(), "public", product.imageUrl));
    } catch { /* already gone */ }
  }

  const ext = extFromMime(file.type);
  const fileName = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));

  const imageUrl = `/uploads/products/${params.id}/${fileName}`;
  const updated = await prisma.product.update({
    where: { id: params.id },
    data: { imageUrl },
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
    try {
      await fs.unlink(path.join(process.cwd(), "public", product.imageUrl));
    } catch { /* already gone */ }
    await prisma.product.update({ where: { id: params.id }, data: { imageUrl: null } });
  }

  return new NextResponse(null, { status: 204 });
});

function extFromMime(mime: string) {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png":  return "png";
    case "image/webp": return "webp";
    case "image/gif":  return "gif";
    default:           return "jpg";
  }
}
