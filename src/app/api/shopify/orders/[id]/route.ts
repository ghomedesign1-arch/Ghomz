import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { resolveProductCost } from "@/lib/product-cost";
import {
  getOrderMeta,
  getShopifyToken,
  setOrderMeta,
  type ShopifyOrderMeta,
  type ShopifyOrderPriority,
  type ShopifyOrderStatus,
  type ShopifyOrderSummary,
  type ShopifyPaymentMode,
} from "@/lib/shopify";

const VALID_STATUS: ShopifyOrderStatus[] = [
  "NEW",
  "SCHEDULED",
  "IN_PRODUCTION",
  "READY",
  "SHIPPED",
  "CANCELLED",
];
const VALID_PRIORITY: ShopifyOrderPriority[] = ["LOW", "NORMAL", "URGENT"];
const VALID_PAYMENT_MODE: ShopifyPaymentMode[] = ["AUTO", "FULL", "DEPOSIT"];

export const PATCH = withApi(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");

  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) throw new HttpError(400, "Bad order id");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.promote === true) {
    const next = await promoteOrder(orderId);
    return NextResponse.json(next);
  }

  const patch: Partial<ShopifyOrderMeta> = {};
  if (typeof body.status === "string") {
    if (!VALID_STATUS.includes(body.status as ShopifyOrderStatus))
      throw new HttpError(422, "Bad status");
    patch.status = body.status as ShopifyOrderStatus;
  }
  if (typeof body.priority === "string") {
    if (!VALID_PRIORITY.includes(body.priority as ShopifyOrderPriority))
      throw new HttpError(422, "Bad priority");
    patch.priority = body.priority as ShopifyOrderPriority;
  }
  if ("assignedToId" in body) {
    const v = body.assignedToId;
    patch.assignedToId = v === null || v === "" ? null : String(v);
  }
  if ("deliveryDate" in body) {
    const v = body.deliveryDate;
    patch.deliveryDate = v === null || v === "" ? null : String(v);
  }
  if ("notes" in body) {
    const v = body.notes;
    patch.notes = v === null || v === "" ? null : String(v);
  }
  if (typeof body.paymentMode === "string") {
    if (!VALID_PAYMENT_MODE.includes(body.paymentMode as ShopifyPaymentMode))
      throw new HttpError(422, "Bad payment mode");
    patch.paymentMode = body.paymentMode as ShopifyPaymentMode;
    if (patch.paymentMode === "FULL") patch.depositAmount = null;
  }
  if ("depositAmount" in body) {
    const v = body.depositAmount;
    if (v === null || v === "") {
      patch.depositAmount = null;
    } else {
      const num = Number(v);
      if (!Number.isFinite(num) || num < 0)
        throw new HttpError(422, "Bad deposit amount");
      patch.depositAmount = num;
    }
  }

  const next = await setOrderMeta(orderId, patch);
  return NextResponse.json(next);
});

async function promoteOrder(orderId: number): Promise<ShopifyOrderMeta> {
  const existing = await getOrderMeta(orderId);
  if (existing.productionLogId) {
    const stillThere = await prisma.productionLog.findUnique({
      where: { id: existing.productionLogId },
      select: { id: true },
    });
    if (stillThere) {
      throw new HttpError(409, "This order already has a production run");
    }
  }

  const conn = await getShopifyToken();
  if (!conn) throw new HttpError(400, "Shopify not connected");

  const url = `https://${conn.shop}/admin/api/2024-10/orders/${orderId}.json`;
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": conn.token,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(502, `Shopify order fetch failed (${res.status}) ${text}`);
  }
  const payload = (await res.json()) as { order?: ShopifyOrderSummary };
  const order = payload.order;
  if (!order) throw new HttpError(404, "Order not found on Shopify");

  const skuSet = Array.from(
    new Set(order.line_items.map((li) => li.sku).filter(Boolean) as string[]),
  );
  if (skuSet.length === 0) {
    throw new HttpError(
      422,
      "No SKUs on the order's line items — can't match an internal product",
    );
  }
  const products = await prisma.product.findMany({
    where: { sku: { in: skuSet } },
    select: { id: true, sku: true, name: true },
  });
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const grouped = new Map<string, number>();
  for (const li of order.line_items) {
    if (!li.sku) continue;
    const p = bySku.get(li.sku);
    if (!p) continue;
    grouped.set(p.id, (grouped.get(p.id) ?? 0) + li.quantity);
  }
  if (grouped.size === 0) {
    throw new HttpError(
      422,
      `No internal product matches these SKUs: ${skuSet.join(", ")}`,
    );
  }

  const customerName =
    [order.customer?.first_name, order.customer?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || order.customer?.email || null;
  const shippingAddress = order.shipping_address;
  const addressStr = shippingAddress
    ? [
        shippingAddress.name,
        shippingAddress.address1,
        shippingAddress.address2,
        shippingAddress.city,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  let firstLogId: string | null = null;
  for (const [productId, qty] of Array.from(grouped.entries())) {
    const { breakdown } = await resolveProductCost(productId);
    const unitCost = breakdown.totalCost;
    const log = await prisma.productionLog.create({
      data: {
        productId,
        quantity: qty,
        unitCost,
        totalCost: unitCost * qty,
        clientName: customerName,
        clientPhone: order.customer?.phone ?? shippingAddress?.phone ?? null,
        clientAddress: addressStr,
        deliveryDate: existing.deliveryDate
          ? new Date(existing.deliveryDate)
          : null,
        priority: existing.priority,
        notes: `Shopify ${order.name}${existing.notes ? ` — ${existing.notes}` : ""}`,
      },
      select: { id: true },
    });
    if (!firstLogId) firstLogId = log.id;
  }

  return setOrderMeta(orderId, {
    productionLogId: firstLogId,
    status:
      existing.status === "NEW" || existing.status === "SCHEDULED"
        ? "IN_PRODUCTION"
        : existing.status,
  });
}
