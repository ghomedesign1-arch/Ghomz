import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const SHOP_DOMAIN_KEY = "shopify.shopDomain";
const ACCESS_TOKEN_KEY = "shopify.accessToken";
const SCOPES_KEY = "shopify.scopes";
const API_VERSION = "2024-10";
const META_KEY_PREFIX = "shopify.order.";

export const SHOPIFY_SCOPES = [
  "read_orders",
  "write_orders",
  "read_products",
  "read_fulfillments",
  "read_customers",
].join(",");

export function getShopifyEnv() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!shop || !clientId || !clientSecret) {
    throw new Error(
      "Missing SHOPIFY_SHOP_DOMAIN / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET",
    );
  }
  return { shop, clientId, clientSecret };
}

export function verifyOAuthHmac(
  query: Record<string, string>,
  secret: string,
): boolean {
  const { hmac, signature: _sig, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("&");
  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(hmac, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function exchangeCodeForToken(
  shop: string,
  code: string,
): Promise<{ access_token: string; scope: string }> {
  const { clientId, clientSecret } = getShopifyEnv();
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function saveShopifyToken(
  shop: string,
  accessToken: string,
  scope: string,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: SHOP_DOMAIN_KEY },
      create: { key: SHOP_DOMAIN_KEY, value: shop, updatedAt: now },
      update: { value: shop, updatedAt: now },
    }),
    prisma.setting.upsert({
      where: { key: ACCESS_TOKEN_KEY },
      create: { key: ACCESS_TOKEN_KEY, value: accessToken, updatedAt: now },
      update: { value: accessToken, updatedAt: now },
    }),
    prisma.setting.upsert({
      where: { key: SCOPES_KEY },
      create: { key: SCOPES_KEY, value: scope, updatedAt: now },
      update: { value: scope, updatedAt: now },
    }),
  ]);
}

export async function getShopifyToken(): Promise<{
  shop: string;
  token: string;
} | null> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [SHOP_DOMAIN_KEY, ACCESS_TOKEN_KEY] } },
  });
  const shop = rows.find((r) => r.key === SHOP_DOMAIN_KEY)?.value;
  const token = rows.find((r) => r.key === ACCESS_TOKEN_KEY)?.value;
  if (!shop || !token) return null;
  return { shop, token };
}

export interface ShopifyLineItem {
  id: number;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  current_quantity?: number | null;
  fulfillable_quantity?: number | null;
  price: string;
}

export interface ShopifyAddress {
  name?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  zip?: string | null;
  phone?: string | null;
  company?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ShopifyOrderSummary {
  id: number;
  name: string;
  created_at: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  total_price: string;
  current_total_price: string | null;
  subtotal_price: string | null;
  current_subtotal_price: string | null;
  total_discounts: string | null;
  current_total_discounts: string | null;
  total_tax: string | null;
  current_total_tax: string | null;
  total_outstanding: string | null;
  currency: string;
  note: string | null;
  customer: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  shipping_address: ShopifyAddress | null;
  billing_address: ShopifyAddress | null;
  line_items: ShopifyLineItem[];
}

export async function fetchRecentOrders(
  days = 30,
): Promise<ShopifyOrderSummary[]> {
  const conn = await getShopifyToken();
  if (!conn) throw new Error("Shopify not connected");
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const url = new URL(
    `https://${conn.shop}/admin/api/${API_VERSION}/orders.json`,
  );
  url.searchParams.set("status", "any");
  url.searchParams.set("created_at_min", since);
  url.searchParams.set("limit", "100");
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": conn.token,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify orders fetch failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { orders?: ShopifyOrderSummary[] };
  return data.orders ?? [];
}

export async function fetchOrderById(
  orderId: number,
): Promise<ShopifyOrderSummary | null> {
  const conn = await getShopifyToken();
  if (!conn) return null;
  const res = await fetch(
    `https://${conn.shop}/admin/api/${API_VERSION}/orders/${orderId}.json`,
    {
      headers: {
        "X-Shopify-Access-Token": conn.token,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { order?: ShopifyOrderSummary };
  return data.order ?? null;
}

export function shopAdminOrderUrl(shop: string, orderId: number): string {
  return `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/orders/${orderId}`;
}

// ─── ERP-side metadata (stored as JSON in the Setting table) ─────────────────

export type ShopifyOrderStatus =
  | "NEW"
  | "SCHEDULED"
  | "IN_PRODUCTION"
  | "READY"
  | "SHIPPED"
  | "CANCELLED";

export type ShopifyOrderPriority = "LOW" | "NORMAL" | "URGENT";

export type ShopifyPaymentMode = "AUTO" | "FULL" | "DEPOSIT" | "UNPAID";

export type CallOutcome = "no_answer" | "answered" | "promised";

export interface CallAttempt {
  at: string; // ISO
  outcome: CallOutcome;
  byUserId?: string | null;
}

export const MAX_CALL_ATTEMPTS = 3;

export interface ReceiptAttachment {
  url: string;
  contentType: string;
  fileName: string;
  uploadedAt: string;
}

export interface ShopifyOrderMeta {
  status: ShopifyOrderStatus;
  priority: ShopifyOrderPriority;
  assignedToId: string | null;
  deliveryDate: string | null;
  notes: string | null;
  productionLogId: string | null;
  paymentMode: ShopifyPaymentMode;
  depositAmount: number | null;
  discount: number | null;
  callAttempts: CallAttempt[];
  receipts: ReceiptAttachment[];
  scheduledFor: string | null;
  confirmationSentAt: string | null;
  deliveryDateSentAt: string | null;
  depositRequestSentAt: string | null;
  cancellationSentAt: string | null;
  thanksSentAt: string | null;
  lineOverrides: Record<string, LineOverride>;
}

/**
 * ERP-side customisation of a single Shopify line item. Set only the fields
 * you want to override; nulls / undefined fall back to the original Shopify
 * value when the invoice, totals and production queue are computed.
 */
export interface LineOverride {
  customTitle?: string | null;
  customVariant?: string | null;
  customPrice?: number | null;
  customQuantity?: number | null;
  note?: string | null;
  editedAt: string;
}

export const DEFAULT_ORDER_META: ShopifyOrderMeta = {
  status: "NEW",
  priority: "NORMAL",
  assignedToId: null,
  deliveryDate: null,
  notes: null,
  productionLogId: null,
  paymentMode: "AUTO",
  depositAmount: null,
  discount: null,
  callAttempts: [],
  receipts: [],
  scheduledFor: null,
  confirmationSentAt: null,
  deliveryDateSentAt: null,
  depositRequestSentAt: null,
  cancellationSentAt: null,
  thanksSentAt: null,
  lineOverrides: {},
};

/**
 * Resolved line item: Shopify data merged with its ERP override so callers
 * can treat it as a single uniform shape.
 */
export interface EffectiveLineItem {
  id: number;
  sku: string | null;
  title: string;
  variantTitle: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note: string | null;
  isCustom: boolean;
  original: {
    title: string;
    variantTitle: string | null;
    unitPrice: number;
    quantity: number;
  };
}

export function effectiveLineItems(
  order: { line_items: ShopifyLineItem[] },
  meta: ShopifyOrderMeta,
): EffectiveLineItem[] {
  return order.line_items.map((li) => {
    const override = meta.lineOverrides?.[String(li.id)];
    const originalQty = li.current_quantity ?? li.quantity ?? 0;
    const originalPrice = Number(li.price ?? 0);
    const quantity =
      override?.customQuantity != null ? override.customQuantity : originalQty;
    const unitPrice =
      override?.customPrice != null ? override.customPrice : originalPrice;
    const title = override?.customTitle?.trim() || li.title;
    const variantTitle =
      override?.customVariant?.trim() ?? li.variant_title ?? null;
    return {
      id: li.id,
      sku: li.sku,
      title,
      variantTitle,
      unitPrice,
      quantity,
      lineTotal: unitPrice * quantity,
      note: override?.note ?? null,
      isCustom: Boolean(override),
      original: {
        title: li.title,
        variantTitle: li.variant_title,
        unitPrice: originalPrice,
        quantity: originalQty,
      },
    };
  });
}

export function effectiveSubtotal(items: EffectiveLineItem[]): number {
  return items.reduce((a, i) => a + (i.quantity > 0 ? i.lineTotal : 0), 0);
}

/** YYYY-MM-DD for a date offset from today in the server's timezone. */
export function offsetIsoDate(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

export function todayIsoDate(): string {
  return offsetIsoDate(0);
}

export function tomorrowIsoDate(): string {
  return offsetIsoDate(1);
}

/** Payment kind as the ERP sees it, respecting the paymentMode override. */
export function resolvePaymentKind(
  order: {
    financial_status: string | null;
    total_price: string;
    current_total_price?: string | null;
    total_outstanding?: string | null;
  },
  meta: ShopifyOrderMeta,
): "paid" | "deposit" | "unpaid" | "refunded" {
  const raw = Number(order.current_total_price ?? order.total_price ?? 0);
  const total = Math.max(0, raw - Math.max(0, Number(meta.discount ?? 0)));
  const status = (order.financial_status ?? "").toLowerCase();
  if (meta.paymentMode === "FULL") return "paid";
  if (meta.paymentMode === "UNPAID") return "unpaid";
  if (meta.paymentMode === "DEPOSIT") {
    const deposit = Math.max(0, Number(meta.depositAmount ?? 0));
    if (total - deposit <= 0.009) return "paid";
    if (deposit > 0.009) return "deposit";
    return "unpaid";
  }
  if (status === "refunded" || status === "voided") return "refunded";
  // Payments Shopify already saw: raw − outstanding. Then the ERP discount
  // reduces what the customer still owes.
  const paidFromShopify = raw - Number(order.total_outstanding ?? 0);
  const stillOwed = Math.max(0, total - paidFromShopify);
  if (stillOwed <= 0.009) return "paid";
  if (paidFromShopify > 0.009) return "deposit";
  return "unpaid";
}

/** Hours the customer gets to reply after the WhatsApp cancellation notice. */
export const CANCEL_GRACE_HOURS = 24;

/**
 * When the cancellation notice was sent and the order is still open and
 * unpaid, returns the time it can be cancelled in Shopify. Null otherwise.
 */
export function cancelDeadline(
  order: Parameters<typeof resolvePaymentKind>[0],
  meta: ShopifyOrderMeta,
): Date | null {
  if (!meta.cancellationSentAt) return null;
  if (meta.status === "CANCELLED" || meta.status === "SHIPPED") return null;
  if (resolvePaymentKind(order, meta) !== "unpaid") return null;
  const sent = new Date(meta.cancellationSentAt).getTime();
  if (Number.isNaN(sent)) return null;
  return new Date(sent + CANCEL_GRACE_HOURS * 3_600_000);
}

const metaKey = (id: number) => `${META_KEY_PREFIX}${id}`;

/** Default delivery promise: 14 days after the order is placed. */
export const DEFAULT_LEAD_TIME_DAYS = 14;
export const DUE_SOON_WINDOW_DAYS = 3;

/**
 * Resolves the delivery date for an order. Uses the ERP-side override when
 * set; otherwise falls back to {order date + lead time}.
 */
export function effectiveDeliveryDate(
  orderCreatedAt: string,
  meta: ShopifyOrderMeta,
): Date {
  if (meta.deliveryDate) return new Date(meta.deliveryDate);
  const d = new Date(orderCreatedAt);
  d.setDate(d.getDate() + DEFAULT_LEAD_TIME_DAYS);
  return d;
}

export async function getOrdersMeta(
  ids: number[],
): Promise<Map<number, ShopifyOrderMeta>> {
  const out = new Map<number, ShopifyOrderMeta>();
  if (!ids.length) return out;
  const rows = await prisma.setting.findMany({
    where: { key: { in: ids.map(metaKey) } },
  });
  for (const r of rows) {
    const idStr = r.key.slice(META_KEY_PREFIX.length);
    const id = Number(idStr);
    if (!Number.isFinite(id)) continue;
    try {
      const parsed = JSON.parse(r.value);
      out.set(id, { ...DEFAULT_ORDER_META, ...parsed });
    } catch {
      /* ignore malformed row */
    }
  }
  return out;
}

export async function getOrderMeta(id: number): Promise<ShopifyOrderMeta> {
  return (await getOrdersMeta([id])).get(id) ?? DEFAULT_ORDER_META;
}

export async function setOrderMeta(
  id: number,
  patch: Partial<ShopifyOrderMeta>,
): Promise<ShopifyOrderMeta> {
  const current = await getOrderMeta(id);
  const next: ShopifyOrderMeta = { ...current, ...patch };
  const now = new Date();
  await prisma.setting.upsert({
    where: { key: metaKey(id) },
    create: { key: metaKey(id), value: JSON.stringify(next), updatedAt: now },
    update: { value: JSON.stringify(next), updatedAt: now },
  });
  return next;
}
