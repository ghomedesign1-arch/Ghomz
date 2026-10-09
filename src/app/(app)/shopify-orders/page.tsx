import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import {
  fetchRecentOrders,
  getShopifyToken,
  shopAdminOrderUrl,
  type ShopifyOrderSummary,
} from "@/lib/shopify";

export const dynamic = "force-dynamic";

export default async function ShopifyOrdersPage() {
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Shopify orders"
        description={`Last 30 days from ${connection.shop} · ${orders.length} order${orders.length === 1 ? "" : "s"}`}
      />

      {error && (
        <Card>
          <CardContent className="px-6 py-6 text-sm text-destructive">
            Couldn&apos;t load orders: {error}
          </CardContent>
        </Card>
      )}

      {!error && orders.length === 0 && (
        <Card>
          <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">
            No orders in the last 30 days.
          </CardContent>
        </Card>
      )}

      {orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              shopUrl={shopAdminOrderUrl(connection.shop, o.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  shopUrl,
}: {
  order: ShopifyOrderSummary;
  shopUrl: string;
}) {
  const customerName = order.customer
    ? [order.customer.first_name, order.customer.last_name]
        .filter(Boolean)
        .join(" ") || order.customer.email || "—"
    : "—";
  const date = new Date(order.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const totalItems = order.line_items.reduce((a, i) => a + i.quantity, 0);

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <Link
                href={shopUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {order.name}
              </Link>
              <StatusBadge
                label={order.financial_status ?? "pending"}
                tone={
                  order.financial_status === "paid"
                    ? "success"
                    : order.financial_status === "refunded"
                      ? "destructive"
                      : "outline"
                }
              />
              <StatusBadge
                label={order.fulfillment_status ?? "unfulfilled"}
                tone={
                  order.fulfillment_status === "fulfilled"
                    ? "success"
                    : "outline"
                }
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {customerName} · {date}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-semibold">
              {Number(order.total_price).toLocaleString("en-EG", {
                maximumFractionDigits: 2,
              })}{" "}
              {order.currency}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalItems} item{totalItems === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="divide-y divide-border border-t border-border">
          {order.line_items.map((li) => (
            <div
              key={li.id}
              className="flex items-start justify-between gap-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{li.title}</div>
                {(li.variant_title || li.sku) && (
                  <div className="text-xs text-muted-foreground">
                    {[li.variant_title, li.sku].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div>×{li.quantity}</div>
                <div className="text-xs text-muted-foreground">
                  {Number(li.price).toLocaleString("en-EG")} {order.currency}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "outline" | "destructive";
}) {
  return (
    <Badge
      variant={tone === "success" ? "success" : tone === "destructive" ? "destructive" : "outline"}
      className="text-[10px] capitalize"
    >
      {label.replace(/_/g, " ")}
    </Badge>
  );
}
