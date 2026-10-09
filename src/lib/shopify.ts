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
  price: string;
}

export interface ShopifyAddress {
  name?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  phone?: string | null;
}

export interface ShopifyOrderSummary {
  id: number;
  name: string;
  created_at: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  customer: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  shipping_address: ShopifyAddress | null;
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

export interface ShopifyOrderMeta {
  status: ShopifyOrderStatus;
  priority: ShopifyOrderPriority;
  assignedToId: string | null;
  deliveryDate: string | null;
  notes: string | null;
  productionLogId: string | null;
}

export const DEFAULT_ORDER_META: ShopifyOrderMeta = {
  status: "NEW",
  priority: "NORMAL",
  assignedToId: null,
  deliveryDate: null,
  notes: null,
  productionLogId: null,
};

const metaKey = (id: number) => `${META_KEY_PREFIX}${id}`;

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
