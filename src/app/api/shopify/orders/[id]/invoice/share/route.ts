import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { uploadBuffer } from "@/lib/cloudinary";
import {
  getOrderMeta,
  getShopifyToken,
  type ShopifyOrderSummary,
} from "@/lib/shopify";
import {
  invoiceFileName,
  loadInvoiceBranding,
  renderInvoicePdf,
} from "@/lib/pdf/customer-invoice";

/**
 * POST /api/shopify/orders/[id]/invoice/share
 *
 * Generates the invoice PDF, uploads it to Cloudinary under
 * shopify-invoices/{orderId}, and returns a public URL that can be shared
 * via WhatsApp.
 */
export const POST = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) throw new HttpError(400, "Bad order id");

  const conn = await getShopifyToken();
  if (!conn) throw new HttpError(400, "Shopify not connected");

  const res = await fetch(
    `https://${conn.shop}/admin/api/2024-10/orders/${orderId}.json`,
    {
      headers: {
        "X-Shopify-Access-Token": conn.token,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(502, `Shopify order fetch failed (${res.status}) ${text}`);
  }
  const payload = (await res.json()) as { order?: ShopifyOrderSummary };
  const order = payload.order;
  if (!order) throw new HttpError(404, "Order not found on Shopify");

  const [meta, branding] = await Promise.all([
    getOrderMeta(orderId),
    loadInvoiceBranding(),
  ]);

  let pdf: Buffer;
  try {
    pdf = await renderInvoicePdf({ order, meta, branding });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new HttpError(500, `PDF render failed: ${message}`);
  }

  const fileName = invoiceFileName(order).replace(/\.pdf$/, "");
  const uploaded = await uploadBuffer(pdf, {
    folder: `shopify-invoices/${orderId}`,
    resourceType: "image", // PDFs ride on the image resource for inline delivery
    format: "pdf",
    publicId: `${fileName}-${Date.now()}`,
  });

  return NextResponse.json({ url: uploaded.url, fileName: `${fileName}.pdf` });
});
