import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import {
  deleteByUrl,
  resourceKindFor,
  uploadBuffer,
} from "@/lib/cloudinary";
import {
  getOrderMeta,
  setOrderMeta,
  type ReceiptAttachment,
  type ShopifyOrderMeta,
} from "@/lib/shopify";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per receipt
const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

/**
 * POST /api/shopify/orders/[id]/receipts
 * Multipart upload of a payment-receipt image or PDF. Returns the updated
 * ShopifyOrderMeta with the new attachment appended to `receipts`.
 */
export const POST = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) throw new HttpError(400, "Bad order id");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(422, "No file provided");
  if (file.size > MAX_BYTES)
    throw new HttpError(413, `File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
  if (!ACCEPTED_TYPES.has(file.type))
    throw new HttpError(
      415,
      `Unsupported file type ${file.type || "(unknown)"}. Use JPG / PNG / WEBP / HEIC / PDF.`,
    );

  const uploaded = await uploadBuffer(
    Buffer.from(await file.arrayBuffer()),
    {
      folder: `shopify-receipts/${orderId}`,
      resourceType: resourceKindFor(file.type),
      format: file.type === "application/pdf" ? "pdf" : undefined,
    },
  );

  const attachment: ReceiptAttachment = {
    url: uploaded.url,
    contentType: file.type,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  };

  const existing = await getOrderMeta(orderId);
  const next: ShopifyOrderMeta = await setOrderMeta(orderId, {
    receipts: [...existing.receipts, attachment],
  });
  return NextResponse.json(next);
});

/**
 * DELETE /api/shopify/orders/[id]/receipts?url=...
 * Removes a specific receipt (also deletes it from Cloudinary).
 */
export const DELETE = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) throw new HttpError(400, "Bad order id");

  const url = req.nextUrl.searchParams.get("url");
  if (!url) throw new HttpError(422, "url param required");

  const existing = await getOrderMeta(orderId);
  const match = existing.receipts.find((r) => r.url === url);
  if (!match) throw new HttpError(404, "Receipt not found on this order");

  await deleteByUrl(url);

  const next = await setOrderMeta(orderId, {
    receipts: existing.receipts.filter((r) => r.url !== url),
  });
  return NextResponse.json(next);
});
