import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import {
  effectiveLineItems,
  fetchRecentOrders,
  getOrdersMeta,
  getShopifyToken,
  type ShopifyOrderMeta,
  type ShopifyOrderSummary,
} from "@/lib/shopify";
import { WorkOrderActions } from "@/components/shopify/work-order-actions";

export const dynamic = "force-dynamic";

const DEFAULT_META: ShopifyOrderMeta = {
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

export default async function WorkOrderPage({
  searchParams,
}: {
  searchParams?: { products?: string };
}) {
  const connection = await getShopifyToken().catch(() => null);
  if (!connection) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Factory work order"
          description="Shopify is not connected."
        />
      </div>
    );
  }

  const productsRaw = (searchParams?.products ?? "").trim();
  const selected = new Set(
    productsRaw ? productsRaw.split("|").filter(Boolean) : [],
  );

  let orders: ShopifyOrderSummary[] = [];
  try {
    orders = await fetchRecentOrders(60);
  } catch {
    /* ignore — empty state below */
  }
  const metaMap = await getOrdersMeta(orders.map((o) => o.id));
  const metaFor = (o: ShopifyOrderSummary) =>
    metaMap.get(o.id) ?? DEFAULT_META;
  const productKey = (title: string, variant: string | null) =>
    `${title}||${variant ?? ""}`;

  type Row = {
    key: string;
    title: string;
    variant: string | null;
    totalQty: number;
    orderRefs: {
      name: string;
      qty: number;
      deliveryIso: string | null;
      customer: string;
    }[];
  };
  const rowMap = new Map<string, Row>();

  for (const o of orders) {
    const m = metaFor(o);
    if (m.status === "SHIPPED" || m.status === "CANCELLED") continue;
    const lines = effectiveLineItems(o, m);
    for (const li of lines) {
      if (li.quantity <= 0) continue;
      const key = productKey(li.title, li.variantTitle);
      if (selected.size > 0 && !selected.has(key)) continue;
      const row =
        rowMap.get(key) ??
        ({
          key,
          title: li.title,
          variant: li.variantTitle,
          totalQty: 0,
          orderRefs: [],
        } as Row);
      row.totalQty += li.quantity;
      row.orderRefs.push({
        name: o.name,
        qty: li.quantity,
        deliveryIso: m.deliveryDate,
        customer:
          [o.customer?.first_name, o.customer?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          o.customer?.email ||
          "Guest",
      });
      rowMap.set(key, row);
    }
  }

  const rows = Array.from(rowMap.values()).sort(
    (a, b) => b.totalQty - a.totalQty || a.title.localeCompare(b.title),
  );
  const totalUnits = rows.reduce((a, r) => a + r.totalQty, 0);
  const totalOrdersSet = new Set<string>();
  rows.forEach((r) => r.orderRefs.forEach((o) => totalOrdersSet.add(o.name)));
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const whatsappText = [
    "G-Homz Factory Work Order",
    `Date: ${today}`,
    "",
    "Please produce:",
    ...rows.map(
      (r) =>
        `• ${r.totalQty}× ${r.title}${r.variant ? ` — ${r.variant}` : ""}`,
    ),
    "",
    `Total units: ${totalUnits}`,
    `Across ${totalOrdersSet.size} order${totalOrdersSet.size === 1 ? "" : "s"}`,
  ].join("\n");

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="print:hidden">
        <PageHeader
          title="Factory work order"
          description={`${rows.length} line${rows.length === 1 ? "" : "s"} · ${totalUnits} unit${totalUnits === 1 ? "" : "s"} · ${totalOrdersSet.size} order${totalOrdersSet.size === 1 ? "" : "s"}`}
          actions={
            <WorkOrderActions
              text={whatsappText}
              hasRows={rows.length > 0}
            />
          }
        />
        <div className="mt-2 text-sm">
          <Link
            href={`/shopify-orders${productsRaw ? `?products=${productsRaw}` : ""}`}
            className="text-muted-foreground hover:underline"
          >
            ← Back to orders
          </Link>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-semibold">G-Homz · Factory work order</h1>
        <div className="text-sm text-muted-foreground">{today}</div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
            {selected.size === 0
              ? "No products selected. Go back to the orders page, pick products from the filter, then click Generate work order."
              : "No matching orders in the production pipeline for the selected products."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Dimension / variant</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className="border-t border-border align-top"
                  >
                    <td className="px-3 py-3 font-medium">{r.title}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {r.variant ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-display text-lg font-semibold">
                      ×{r.totalQty}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-slate-50">
                  <td className="px-3 py-3 text-sm font-semibold" colSpan={2}>
                    Total
                  </td>
                  <td className="px-3 py-3 text-right font-display text-lg font-semibold">
                    ×{totalUnits}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Order references
            </h2>
            <div className="space-y-3">
              {rows.map((r) => (
                <div
                  key={r.key}
                  className="rounded-md border border-border p-3 text-sm"
                >
                  <div className="mb-1 font-medium">
                    {r.title}
                    {r.variant && (
                      <span className="text-muted-foreground">
                        {" "}
                        — {r.variant}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {r.orderRefs.map((o, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="font-mono">{o.name}</span>
                        <span>· {o.customer}</span>
                        <span>· ×{o.qty}</span>
                        {o.deliveryIso && (
                          <span>
                            · deliver{" "}
                            {new Date(o.deliveryIso).toLocaleDateString(
                              "en-GB",
                              {
                                day: "numeric",
                                month: "short",
                              },
                            )}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
