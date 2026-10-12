import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import {
  getOrderMeta,
  getShopifyToken,
  type ShopifyOrderSummary,
} from "@/lib/shopify";
import { invoiceFileName, renderInvoicePdf } from "@/lib/pdf/customer-invoice";

/**
 * GET /api/shopify/orders/[id]/invoice
 * Streams back a PDF invoice for the given Shopify order using the ERP's
 * meta overrides (discount, deposit, payment mode) for the totals.
 */
export const GET = withApi(async (
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

  const meta = await getOrderMeta(orderId);
  const pdf = await renderInvoicePdf({ order, meta });
  const bytes = new Uint8Array(pdf);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceFileName(order)}"`,
      "Cache-Control": "no-store",
    },
  });
});
