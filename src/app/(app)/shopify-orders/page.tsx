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
  resolvePaymentKind,
  shopAdminOrderUrl,
  todayIsoDate,
  tomorrowIsoDate,
  type ShopifyOrderMeta,
  type ShopifyOrderStatus,
  type ShopifyOrderSummary,
} from "@/lib/shopify";
import {
  TomorrowQueue,
  type TomorrowOrderEntry,
} from "@/components/shopify/tomorrow-queue";
import { OrdersSection } from "@/components/shopify/shipped-section";
import { InvoiceBrandingDialog } from "@/components/shopify/invoice-branding-dialog";
import { NewOrdersWatcher } from "@/components/shopify/new-orders-watcher";
import { ShopifyOrderRow } from "@/components/shopify/order-row";
import { RevenueSummary } from "@/components/shopify/revenue-summary";
import type { ProductionQueueItem } from "@/components/shopify/production-queue";

export const dynamic = "force-dynamic";

const TILE_CONFIG: {
  key: ShopifyOrderStatus | "OVERDUE" | "DUE_SOON" | "ALL";
  label: string;
  tone: string;
}[] = [
  { key: "ALL", label: "All", tone: "border-slate-300 bg-slate-100" },
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
  searchParams?: {
    status?: string;
    q?: string;
    payment?: string;
    sort?: string;
  };
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
      discount: null,
      callAttempts: [],
      receipts: [],
      scheduledFor: null,
      confirmationSentAt: null,
      deliveryDateSentAt: null,
      depositRequestSentAt: null,
      cancellationSentAt: null,
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
  let revenueExpected = 0;
  let revenueCollected = 0;
  let revenueCurrency: string | null = null;
  const paymentCounts = { PAID: 0, DEPOSIT: 0, UNPAID: 0 } as Record<string, number>;
  for (const o of activeOrders) {
    const m = metaFor(o);
    tileCounts[m.status] = (tileCounts[m.status] ?? 0) + 1;
    if (m.status !== "SHIPPED" && m.status !== "CANCELLED") {
      const dueMs = effectiveDeliveryDate(o.created_at, m).getTime();
      if (dueMs < now) tileCounts.OVERDUE++;
      else if (dueMs <= dueSoonCutoff) tileCounts.DUE_SOON++;
    }
    if (m.status === "CANCELLED") continue;
    revenueCurrency = revenueCurrency ?? o.currency;
    const rawTotal = Number(o.current_total_price ?? o.total_price ?? 0);
    const erpDiscount = Math.max(0, Number(m.discount ?? 0));
    const total = Math.max(0, rawTotal - erpDiscount);
    revenueExpected += total;
    if (m.paymentMode === "FULL") {
      revenueCollected += total;
    } else if (m.paymentMode === "DEPOSIT") {
      revenueCollected += Math.min(total, Math.max(0, Number(m.depositAmount ?? 0)));
    } else {
      const paidFromShopify = Math.max(
        0,
        rawTotal - Number(o.total_outstanding ?? 0),
      );
      revenueCollected += Math.min(total, paidFromShopify);
    }
    const kind = resolvePaymentKind(o, m);
    if (kind === "paid") paymentCounts.PAID++;
    else if (kind === "deposit") paymentCounts.DEPOSIT++;
    else if (kind === "unpaid") paymentCounts.UNPAID++;
  }
  const revenueOutstanding = Math.max(0, revenueExpected - revenueCollected);

  // ── Production queue: aggregate line items from orders that still
  // need to be made (NEW / SCHEDULED / IN_PRODUCTION), grouping by
  // product + variant so Baby Blue vs Light Beige show separately.
  const productionAcc = new Map<string, ProductionQueueItem>();
  let productionUnits = 0;
  const today = todayIsoDate();
  const tomorrow = tomorrowIsoDate();
  const todayScheduled: TomorrowOrderEntry[] = [];
  const tomorrowScheduled: TomorrowOrderEntry[] = [];
  for (const o of activeOrders) {
    const m = metaFor(o);
    if (
      m.status !== "NEW" &&
      m.status !== "SCHEDULED" &&
      m.status !== "IN_PRODUCTION"
    ) {
      continue;
    }
    for (const li of o.line_items) {
      const qty = li.current_quantity ?? li.quantity ?? 0;
      if (qty <= 0) continue;
      const key = `${li.title}||${li.variant_title ?? ""}||${li.sku ?? ""}`;
      const existing = productionAcc.get(key);
      if (existing) {
        existing.quantity += qty;
        existing.orderCount += 1;
      } else {
        productionAcc.set(key, {
          title: li.title,
          variant: li.variant_title,
          sku: li.sku,
          quantity: qty,
          orderCount: 1,
        });
      }
      productionUnits += qty;
    }
    if (m.scheduledFor === today || m.scheduledFor === tomorrow) {
      const items = o.line_items
        .map((li) => ({
          title: li.title,
          variant: li.variant_title,
          sku: li.sku,
          quantity: li.current_quantity ?? li.quantity ?? 0,
        }))
        .filter((i) => i.quantity > 0);
      const customer = (
        [o.customer?.first_name, o.customer?.last_name]
          .filter(Boolean)
          .join(" ") ||
        o.customer?.email ||
        "Guest"
      ).trim();
      const entry = { id: o.id, name: o.name, customer, items };
      if (m.scheduledFor === today) todayScheduled.push(entry);
      else tomorrowScheduled.push(entry);
    }
  }
  const productionItems = Array.from(productionAcc.values()).sort(
    (a, b) => b.quantity - a.quantity,
  );

  const activeStatus = (searchParams?.status ?? "").toUpperCase();
  const activePayment = (searchParams?.payment ?? "").toUpperCase();
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
    if (activePayment) {
      const kind = resolvePaymentKind(o, m);
      if (activePayment === "PAID" && kind !== "paid") return false;
      if (activePayment === "DEPOSIT" && kind !== "deposit") return false;
      if (activePayment === "UNPAID" && kind !== "unpaid") return false;
    }
    if (query) {
      const hay = [
        o.name,
        o.customer?.first_name,
        o.customer?.last_name,
        o.customer?.email,
        o.customer?.phone,
        o.shipping_address?.phone,
        o.billing_address?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      // Also strip spaces/dashes from phones so "+20 100 123 4567" matches a
      // raw digit search.
      const digits = hay.replace(/[^\d+]/g, "");
      const q = query.replace(/\s+/g, "").toLowerCase();
      if (!hay.includes(query) && !digits.includes(q)) return false;
    }
    return true;
  });

  const sort = (searchParams?.sort ?? "default").toLowerCase();
  filtered.sort((a, b) => {
    const ma = metaFor(a);
    const mb = metaFor(b);
    switch (sort) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "due":
        return (
          effectiveDeliveryDate(a.created_at, ma).getTime() -
          effectiveDeliveryDate(b.created_at, mb).getTime()
        );
      case "value": {
        const va = Number(a.current_total_price ?? a.total_price ?? 0);
        const vb = Number(b.current_total_price ?? b.total_price ?? 0);
        return vb - va;
      }
      case "unpaid": {
        const ka = resolvePaymentKind(a, ma);
        const kb = resolvePaymentKind(b, mb);
        const rank = (k: string) =>
          k === "unpaid" ? 0 : k === "deposit" ? 1 : k === "paid" ? 2 : 3;
        if (rank(ka) !== rank(kb)) return rank(ka) - rank(kb);
        return (
          effectiveDeliveryDate(a.created_at, ma).getTime() -
          effectiveDeliveryDate(b.created_at, mb).getTime()
        );
      }
      case "customer": {
        const na = (
          [a.customer?.first_name, a.customer?.last_name]
            .filter(Boolean)
            .join(" ") || a.customer?.email || ""
        ).toLowerCase();
        const nb = (
          [b.customer?.first_name, b.customer?.last_name]
            .filter(Boolean)
            .join(" ") || b.customer?.email || ""
        ).toLowerCase();
        return na.localeCompare(nb);
      }
      case "default":
      default:
        if (ma.priority !== mb.priority) {
          if (ma.priority === "URGENT") return -1;
          if (mb.priority === "URGENT") return 1;
        }
        return (
          effectiveDeliveryDate(a.created_at, ma).getTime() -
          effectiveDeliveryDate(b.created_at, mb).getTime()
        );
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shopify orders"
        description={`Last 30 days from ${connection.shop} · ${activeOrders.length} order${activeOrders.length === 1 ? "" : "s"}`}
        actions={
          <div className="flex items-center gap-2">
            <InvoiceBrandingDialog />
          </div>
        }
      />

      <NewOrdersWatcher />

      {error && (
        <Card>
          <CardContent className="px-6 py-6 text-sm text-destructive">
            Couldn&apos;t load orders: {error}
          </CardContent>
        </Card>
      )}

      <RevenueSummary
        expected={revenueExpected}
        collected={revenueCollected}
        outstanding={revenueOutstanding}
        currency={revenueCurrency}
        orderCount={activeOrders.filter((o) => metaFor(o).status !== "CANCELLED").length}
      />


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {TILE_CONFIG.map((t) => {
          const count =
            t.key === "ALL" ? activeOrders.length : (tileCounts[t.key] ?? 0);
          const href = {
            pathname: "/shopify-orders",
            query: {
              ...(query ? { q: query } : {}),
              ...(activePayment ? { payment: activePayment.toLowerCase() } : {}),
              ...(sort !== "default" ? { sort } : {}),
              ...(t.key === "ALL" ? {} : { status: t.key.toLowerCase() }),
            },
          };
          const active =
            t.key === "ALL" ? activeStatus === "" : activeStatus === t.key;
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

      {/* ── Payment filter tiles ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { key: "ALL", label: "All", tone: "border-slate-300 bg-slate-100 text-slate-900" },
            { key: "PAID", label: "Fully paid", tone: "border-emerald-200 bg-emerald-50 text-emerald-900" },
            { key: "DEPOSIT", label: "Deposit", tone: "border-amber-200 bg-amber-50 text-amber-900" },
            { key: "UNPAID", label: "Unpaid", tone: "border-rose-200 bg-rose-50 text-rose-900" },
          ] as const
        ).map((p) => {
          const active =
            p.key === "ALL" ? activePayment === "" : activePayment === p.key;
          const href = {
            pathname: "/shopify-orders",
            query: {
              ...(query ? { q: query } : {}),
              ...(activeStatus ? { status: activeStatus.toLowerCase() } : {}),
              ...(sort !== "default" ? { sort } : {}),
              ...(p.key === "ALL" ? {} : { payment: p.key.toLowerCase() }),
            },
          };
          const count =
            p.key === "ALL"
              ? (paymentCounts.PAID ?? 0) +
                (paymentCounts.DEPOSIT ?? 0) +
                (paymentCounts.UNPAID ?? 0)
              : (paymentCounts[p.key] ?? 0);
          return (
            <Link
              key={p.key}
              href={href}
              className={`rounded-xl border p-3 text-left transition-colors ${p.tone} ${active ? "ring-2 ring-primary ring-offset-1" : "hover:brightness-95"}`}
            >
              <div className="text-xs font-medium uppercase tracking-wide opacity-70">
                {p.label}
              </div>
              <div className="mt-1 font-display text-xl font-semibold">
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
          placeholder="Search order # · customer name · phone…"
          className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {activeStatus && (
          <input type="hidden" name="status" value={activeStatus.toLowerCase()} />
        )}
        {activePayment && (
          <input type="hidden" name="payment" value={activePayment.toLowerCase()} />
        )}
        <select
          name="sort"
          defaultValue={sort}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="default">Sort: Priority + due date</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="due">Earliest due date</option>
          <option value="value">Highest total first</option>
          <option value="unpaid">Unpaid first</option>
          <option value="customer">Customer A → Z</option>
        </select>
        <button
          type="submit"
          className="h-9 rounded-md border border-input bg-secondary px-4 text-sm font-medium hover:bg-secondary/80"
        >
          Apply
        </button>
        {(query || activeStatus || activePayment || sort !== "default") && (
          <Link
            href="/shopify-orders"
            className="h-9 rounded-md border border-input bg-background px-4 text-sm font-medium leading-9 text-muted-foreground hover:bg-secondary"
          >
            Clear
          </Link>
        )}
      </form>

      <TomorrowQueue
        todayDate={today}
        tomorrowDate={tomorrow}
        todayOrders={todayScheduled}
        tomorrowOrders={tomorrowScheduled}
      />

      {(() => {
        const activeList = filtered.filter((o) => {
          const s = metaFor(o).status;
          return s !== "SHIPPED" && s !== "READY";
        });
        const readyList = filtered.filter((o) => metaFor(o).status === "READY");
        const shippedList = filtered.filter(
          (o) => metaFor(o).status === "SHIPPED",
        );

        return (
          <>
            {!error &&
              activeList.length === 0 &&
              readyList.length === 0 &&
              shippedList.length === 0 && (
                <Card>
                  <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">
                    {orders.length === 0
                      ? "No orders in the last 30 days."
                      : "No orders match the current filter."}
                  </CardContent>
                </Card>
              )}

            {readyList.length > 0 && (
              <OrdersSection
                variant="ready"
                count={readyList.length}
                defaultOpen={activeStatus === "READY"}
              >
                {readyList.map((o) => (
                  <ShopifyOrderRow
                    key={o.id}
                    order={o}
                    initialMeta={metaFor(o)}
                    shopUrl={shopAdminOrderUrl(connection.shop, o.id)}
                    users={users}
                  />
                ))}
              </OrdersSection>
            )}

            {shippedList.length > 0 && (
              <OrdersSection
                variant="shipped"
                count={shippedList.length}
                defaultOpen={activeStatus === "SHIPPED"}
              >
                {shippedList.map((o) => (
                  <ShopifyOrderRow
                    key={o.id}
                    order={o}
                    initialMeta={metaFor(o)}
                    shopUrl={shopAdminOrderUrl(connection.shop, o.id)}
                    users={users}
                  />
                ))}
              </OrdersSection>
            )}

            {activeList.length > 0 && (
              <div className="space-y-3">
                {activeList.map((o) => (
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
          </>
        );
      })()}
    </div>
  );
}

