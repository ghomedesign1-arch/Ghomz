import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import {
  DUE_SOON_WINDOW_DAYS,
  effectiveDeliveryDate,
  fetchRecentOrders,
  getOrdersMeta,
  getShopifyToken,
  shopAdminOrderUrl,
  type ShopifyOrderMeta,
  type ShopifyOrderStatus,
  type ShopifyOrderSummary,
} from "@/lib/shopify";
import { ShopifyOrderRow } from "@/components/shopify/order-row";

export const dynamic = "force-dynamic";

const TILE_CONFIG: {
  key: ShopifyOrderStatus | "OVERDUE" | "DUE_SOON";
  label: string;
  tone: string;
}[] = [
  { key: "NEW", label: "New", tone: "border-slate-300 bg-slate-50" },
  { key: "SCHEDULED", label: "Scheduled", tone: "border-blue-200 bg-blue-50" },
  { key: "IN_PRODUCTION", label: "In production", tone: "border-amber-200 bg-amber-50" },
  { key: "READY", label: "Ready", tone: "border-emerald-200 bg-emerald-50" },
  { key: "SHIPPED", label: "Shipped", tone: "border-emerald-300 bg-emerald-100" },
  { key: "DUE_SOON", label: "Due soon", tone: "border-amber-300 bg-amber-100" },
  { key: "OVERDUE", label: "Overdue", tone: "border-rose-300 bg-rose-50" },
];

export default async function ShopifyOrdersPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string };
}) {
  const connection = await getShopifyToken().catch(() => null);

  if (!connection) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Shopify orders"
          description="Orders synced from your Shopify storefront."
        />
        <Card>
          <CardContent className="space-y-3 px-6 py-8 text-sm">
            <div className="text-base font-medium">Not connected yet.</div>
            <p className="text-muted-foreground">
              Click Install below to grant the ERP read access to your Shopify
              orders.
            </p>
            <Link
              href="/api/shopify/install"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Install Shopify connection
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  let orders: ShopifyOrderSummary[] = [];
  let error: string | null = null;
  try {
    orders = await fetchRecentOrders(30);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load orders";
  }

  const metaMap = await getOrdersMeta(orders.map((o) => o.id));
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER", "PRODUCTION"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const now = Date.now();
  const metaFor = (o: ShopifyOrderSummary): ShopifyOrderMeta =>
    metaMap.get(o.id) ?? {
      status: "NEW",
      priority: "NORMAL",
      assignedToId: null,
      deliveryDate: null,
      notes: null,
      productionLogId: null,
      paymentMode: "AUTO",
      depositAmount: null,
    };

  const tileCounts: Record<string, number> = {
    NEW: 0,
    SCHEDULED: 0,
    IN_PRODUCTION: 0,
    READY: 0,
    SHIPPED: 0,
    CANCELLED: 0,
    OVERDUE: 0,
    DUE_SOON: 0,
  };
  const activeOrders = orders.filter((o) => {
    const status = (o.financial_status ?? "").toLowerCase();
    return status !== "refunded" && status !== "voided";
  });
  const dueSoonCutoff = now + DUE_SOON_WINDOW_DAYS * 86_400_000;
  for (const o of activeOrders) {
    const m = metaFor(o);
    tileCounts[m.status] = (tileCounts[m.status] ?? 0) + 1;
    if (m.status === "SHIPPED" || m.status === "CANCELLED") continue;
    const dueMs = effectiveDeliveryDate(o.created_at, m).getTime();
    if (dueMs < now) tileCounts.OVERDUE++;
    else if (dueMs <= dueSoonCutoff) tileCounts.DUE_SOON++;
  }

  const activeStatus = (searchParams?.status ?? "").toUpperCase();
  const query = (searchParams?.q ?? "").trim().toLowerCase();

  const filtered = orders.filter((o) => {
    const status = (o.financial_status ?? "").toLowerCase();
    if (status === "refunded" || status === "voided") return false;
    const m = metaFor(o);
    if (activeStatus) {
      if (activeStatus === "OVERDUE" || activeStatus === "DUE_SOON") {
        if (m.status === "SHIPPED" || m.status === "CANCELLED") return false;
        const dueMs = effectiveDeliveryDate(o.created_at, m).getTime();
        if (activeStatus === "OVERDUE" && dueMs >= now) return false;
        if (
          activeStatus === "DUE_SOON" &&
          (dueMs < now || dueMs > dueSoonCutoff)
        )
          return false;
      } else if (m.status !== activeStatus) {
        return false;
      }
    }
    if (query) {
      const hay = [
        o.name,
        o.customer?.first_name,
        o.customer?.last_name,
        o.customer?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const ma = metaFor(a);
    const mb = metaFor(b);
    if (ma.priority !== mb.priority) {
      if (ma.priority === "URGENT") return -1;
      if (mb.priority === "URGENT") return 1;
    }
    // Earlier delivery date first (so soon-due & overdue bubble to the top).
    const dueA = effectiveDeliveryDate(a.created_at, ma).getTime();
    const dueB = effectiveDeliveryDate(b.created_at, mb).getTime();
    return dueA - dueB;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shopify orders"
        description={`Last 30 days from ${connection.shop} · ${activeOrders.length} order${activeOrders.length === 1 ? "" : "s"}`}
      />

      {error && (
        <Card>
          <CardContent className="px-6 py-6 text-sm text-destructive">
            Couldn&apos;t load orders: {error}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TILE_CONFIG.map((t) => {
          const count = tileCounts[t.key] ?? 0;
          const href = {
            pathname: "/shopify-orders",
            query: {
              ...(query ? { q: query } : {}),
              ...(activeStatus === t.key ? {} : { status: t.key.toLowerCase() }),
            },
          };
          const active = activeStatus === t.key;
          return (
            <Link
              key={t.key}
              href={href}
              className={`rounded-xl border p-4 transition-colors ${t.tone} ${active ? "ring-2 ring-primary ring-offset-1" : "hover:brightness-95"}`}
            >
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.label}
              </div>
              <div className="mt-1 font-display text-2xl font-semibold">
                {count}
              </div>
            </Link>
          );
        })}
      </div>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search order # or customer name…"
          className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {activeStatus && (
          <input type="hidden" name="status" value={activeStatus.toLowerCase()} />
        )}
        <button
          type="submit"
          className="h-9 rounded-md border border-input bg-secondary px-4 text-sm font-medium hover:bg-secondary/80"
        >
          Search
        </button>
        {(query || activeStatus) && (
          <Link
            href="/shopify-orders"
            className="h-9 rounded-md border border-input bg-background px-4 text-sm font-medium leading-9 text-muted-foreground hover:bg-secondary"
          >
            Clear
          </Link>
        )}
      </form>

      {!error && filtered.length === 0 && (
        <Card>
          <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">
            {orders.length === 0
              ? "No orders in the last 30 days."
              : "No orders match the current filter."}
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((o) => (
            <ShopifyOrderRow
              key={o.id}
              order={o}
              initialMeta={metaFor(o)}
              shopUrl={shopAdminOrderUrl(connection.shop, o.id)}
              users={users}
            />
          ))}
        </div>
      )}
    </div>
  );
}
