import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { getShopifyToken } from "@/lib/shopify";

/**
 * GET /api/shopify/orders/latest?since={isoDate}
 *
 * Returns a thin summary of the most recent orders created on Shopify so a
 * client-side poller can detect new orders without re-pulling the full
 * payload. When `since` is passed only orders newer than that timestamp are
 * returned.
 */
export const GET = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const conn = await getShopifyToken();
  if (!conn) throw new HttpError(400, "Shopify not connected");

  const since = req.nextUrl.searchParams.get("since");
  const url = new URL(
    `https://${conn.shop}/admin/api/2024-10/orders.json`,
  );
  url.searchParams.set("status", "any");
  url.searchParams.set("limit", "25");
  if (since) url.searchParams.set("created_at_min", since);
  else {
    // Default — last 24 h so we don't blow up when the client hasn't set
    // a last-seen timestamp yet.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    url.searchParams.set("created_at_min", yesterday);
  }
  url.searchParams.set("fields", "id,name,created_at,total_price,currency,customer");

  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": conn.token,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(502, `Shopify latest fetch failed (${res.status}) ${text}`);
  }
  const data = (await res.json()) as { orders?: Array<{
    id: number;
    name: string;
    created_at: string;
    total_price: string;
    currency: string;
    customer?: { first_name?: string | null; last_name?: string | null } | null;
  }> };
  return NextResponse.json({ orders: data.orders ?? [] });
});
