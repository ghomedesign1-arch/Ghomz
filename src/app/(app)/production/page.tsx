import { Badge } from "@/components/ui/badge";
import { ProductionRunDialog } from "@/components/dialogs/production-run-dialog";
import { CustomOrderDialog } from "@/components/dialogs/custom-order-dialog";
import { ProductionRowActions } from "@/components/row-actions/production-row-actions";
import { getProductionRunOptions } from "@/lib/production-options";
import { canWrite, isAdmin } from "@/lib/rbac";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { formatLE } from "@/lib/costing";
import { AlertTriangle, Bell, Clock, FileText, Phone, MapPin } from "lucide-react";
import { CustomOrderRowActions } from "@/components/row-actions/custom-order-row-actions";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "info" | "success" | "warning" | "destructive"> = {
  DRAFT:       "secondary",
  PENDING:     "warning",
  IN_PROGRESS: "info",
  COMPLETED:   "success",
  CANCELLED:   "destructive",
};

const PRIORITY_STYLE: Record<string, string> = {
  NORMAL: "bg-secondary text-secondary-foreground",
  HIGH:   "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  URGENT: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const logsQuery = {
  include: { product: true, operator: true },
  orderBy: { startedAt: "desc" as const },
  take: 100,
} as const;

type LogWithProduct = Awaited<ReturnType<typeof prisma.productionLog.findMany<typeof logsQuery>>>[number];

const customOrdersQuery = {
  include: { items: true },
  orderBy: { createdAt: "desc" as const },
  take: 100,
} as const;
type CustomOrderWithItems = Awaited<ReturnType<typeof prisma.customOrder.findMany<typeof customOrdersQuery>>>[number];

/** Unified shape for both row types rendered in the same table */
type UnifiedRow =
  | { kind: "production"; date: Date; data: LogWithProduct }
  | { kind: "custom";     date: Date; data: CustomOrderWithItems };

async function getLogs(): Promise<LogWithProduct[]> {
  try { return await prisma.productionLog.findMany(logsQuery); } catch { return []; }
}
async function getCustomOrders(): Promise<CustomOrderWithItems[]> {
  try { return await prisma.customOrder.findMany(customOrdersQuery); } catch { return []; }
}

function daysUntil(date: Date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function DeliveryCell({ date, status }: { date: Date | null; status: string }) {
  if (!date) return <span className="text-xs text-muted-foreground">—</span>;
  const delivDays = daysUntil(date);
  const done = status === "COMPLETED" || status === "CANCELLED";
  return (
    <div className="space-y-0.5">
      <div className={`text-sm font-medium whitespace-nowrap ${
        !done && delivDays < 0 ? "text-red-600 dark:text-red-400"
        : !done && delivDays <= 2 ? "text-amber-600 dark:text-amber-400"
        : ""
      }`}>
        {formatDate(date)}
      </div>
      {!done && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {delivDays < 0 ? `${Math.abs(delivDays)}d overdue`
            : delivDays === 0 ? "Today"
            : `${delivDays}d left`}
        </div>
      )}
    </div>
  );
}

function ClientCell({ name, phone, address }: { name: string | null; phone?: string | null; address?: string | null }) {
  if (!name) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      <div className="font-medium text-sm">{name}</div>
      {phone && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />{phone}
        </div>
      )}
      {address && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="max-w-[160px] truncate">{address}</span>
        </div>
      )}
    </div>
  );
}

export default async function ProductionPage() {
  const [logs, customOrders, options, fabrics, writeAccess, adminAccess] = await Promise.all([
    getLogs(),
    getCustomOrders(),
    getProductionRunOptions(),
    prisma.fabric.findMany({ select: { id: true, name: true, costPerMeter: true }, orderBy: { name: "asc" } }),
    canWrite(),
    isAdmin(),
  ]);

  // Merge & sort newest-first
  const rows: UnifiedRow[] = [
    ...logs.map((l): UnifiedRow => ({ kind: "production", date: l.startedAt, data: l })),
    ...customOrders.map((o): UnifiedRow => ({ kind: "custom", date: o.createdAt, data: o })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Totals shown in the table footer. Mirror the per-row math:
  //   netRevenue = totalCost − discount  (production) / sum of line subtotals (custom)
  //   profit     = netRevenue − bomCost
  //   remaining  = netRevenue − deposit  (clamped to 0 when paid in full)
  const totals = rows.reduce(
    (acc, row) => {
      let netRevenue = 0;
      let bomCost    = 0;
      let deposit    = 0;
      let qty        = 0;
      if (row.kind === "production") {
        const l = row.data;
        netRevenue = l.totalCost - (l.discount ?? 0);
        bomCost    = l.unitCost * l.quantity;
        deposit    = l.deposit ?? 0;
        qty        = l.quantity;
      } else {
        const o = row.data;
        netRevenue = o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        bomCost    = o.items.reduce((s, i) => s + i.quantity * i.unitCost,  0);
        deposit    = o.deposit;
        qty        = o.items.reduce((s, i) => s + i.quantity, 0);
      }
      const profit    = netRevenue - bomCost;
      const remaining = Math.max(0, netRevenue - deposit);
      acc.qty       += qty;
      acc.total     += netRevenue;
      acc.profit    += profit;
      acc.deposit   += deposit;
      acc.remaining += remaining;
      return acc;
    },
    { qty: 0, total: 0, profit: 0, deposit: 0, remaining: 0 },
  );
  const overallMarginPct = totals.total > 0 ? (totals.profit / totals.total) * 100 : 0;

  // Delivery alerts: active production orders with deliveryDate within 5 days
  const alerts = logs.filter((l) => {
    if (!l.deliveryDate) return false;
    if (l.status === "COMPLETED" || l.status === "CANCELLED") return false;
    return daysUntil(l.deliveryDate) <= 5;
  });
  // Also include custom order alerts
  const customAlerts = customOrders.filter((o) => {
    if (!o.deliveryDate) return false;
    if (o.status === "COMPLETED" || o.status === "CANCELLED") return false;
    return daysUntil(o.deliveryDate) <= 5;
  });

  const totalOrders = rows.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production orders"
        description="Track manufacturing orders, client details and delivery schedules."
        actions={
          writeAccess ? (
            <div className="flex items-center gap-2">
              <CustomOrderDialog />
              <ProductionRunDialog options={options} availableFabrics={fabrics} />
            </div>
          ) : null
        }
      />

      {/* ── Delivery alert banner ── */}
      {(alerts.length > 0 || customAlerts.length > 0) && (
        <div className="space-y-2">
          {alerts.map((a) => {
            const days = daysUntil(a.deliveryDate!);
            const isOverdue = days < 0;
            const isToday   = days === 0;
            return (
              <div key={a.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                isOverdue ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                : isToday  ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40"
                :            "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
              }`}>
                {isOverdue ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                ) : (
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-medium">
                    {isOverdue ? `OVERDUE by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
                      : isToday ? "Due TODAY"
                      : `Due in ${days} day${days === 1 ? "" : "s"}`}
                  </span>
                  {" · "}
                  <span className="text-muted-foreground">
                    {a.product.name} × {a.quantity}
                    {a.clientName ? ` for ${a.clientName}` : ""}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatDate(a.deliveryDate)}
                </span>
              </div>
            );
          })}
          {customAlerts.map((o) => {
            const days = daysUntil(o.deliveryDate!);
            const isOverdue = days < 0;
            const isToday   = days === 0;
            const firstItem = o.items[0];
            return (
              <div key={o.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                isOverdue ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                : isToday  ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40"
                :            "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
              }`}>
                {isOverdue ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                ) : (
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-medium">
                    {isOverdue ? `OVERDUE by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
                      : isToday ? "Due TODAY"
                      : `Due in ${days} day${days === 1 ? "" : "s"}`}
                  </span>
                  {" · "}
                  <span className="text-muted-foreground">
                    {o.invoiceNo}{firstItem ? ` · ${firstItem.name}` : ""} for {o.clientName}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatDate(o.deliveryDate)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Orders table ── */}
      <Card>
        <CardHeader>
          <CardTitle>All orders</CardTitle>
          <CardDescription>
            {totalOrders} order{totalOrders === 1 ? "" : "s"} · {logs.length} production · {customOrders.length} custom
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No orders yet — create your first order above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order date</TableHead>
                  <TableHead>Product / items</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  if (row.kind === "production") {
                    const l = row.data;
                    const delivDays   = l.deliveryDate ? daysUntil(l.deliveryDate) : null;
                    const isUrgent    = delivDays !== null && delivDays <= 2 && l.status !== "COMPLETED" && l.status !== "CANCELLED";
                    const discountAmt = l.discount ?? 0;
                    const netRevenue  = l.totalCost - discountAmt;
                    const bomCost     = l.unitCost * l.quantity;
                    const profit      = netRevenue - bomCost;
                    const marginPct   = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;
                    const balance     = netRevenue - (l.deposit ?? 0);

                    return (
                      <TableRow key={`prod-${l.id}`} className={isUrgent ? "bg-amber-50/50 dark:bg-amber-950/20" : undefined}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(l.startedAt)}
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">{l.product.name}</div>
                          <div className="text-xs text-muted-foreground">{l.product.sku}</div>
                          {l.priority && l.priority !== "NORMAL" && (
                            <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[l.priority ?? "NORMAL"]}`}>
                              {l.priority}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <ClientCell name={l.clientName} phone={l.clientPhone} address={l.clientAddress} />
                        </TableCell>

                        <TableCell>
                          <DeliveryCell date={l.deliveryDate} status={l.status} />
                        </TableCell>

                        <TableCell>
                          <Badge variant={STATUS_VARIANT[l.status]}>{l.status.replace("_", " ")}</Badge>
                        </TableCell>

                        <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>

                        <TableCell className="text-right">
                          <div className="font-medium tabular-nums">{formatLE(netRevenue)}</div>
                          {discountAmt > 0 && (
                            <div className="text-[10px] text-rose-500 tabular-nums">−{formatLE(discountAmt)} disc.</div>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="tabular-nums font-medium" style={{
                            color: profit <= 0 ? "#dc2626" : marginPct >= 25 ? "#16a34a" : marginPct >= 20 ? "#d97706" : "#dc2626",
                          }}>
                            {formatLE(profit)}
                          </div>
                          <div className="text-[10px] text-muted-foreground tabular-nums">{marginPct.toFixed(1)}%</div>
                        </TableCell>

                        <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                          {l.deposit != null ? formatLE(l.deposit) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>

                        <TableCell className="text-right tabular-nums font-medium">
                          {balance <= 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">Paid</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">{formatLE(balance)}</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          {adminAccess && (
                            <ProductionRowActions
                              run={{
                                id: l.id,
                                productName: l.product.name,
                                unitCost: l.unitCost,
                                retailPrice: l.product.retailPrice,
                                wholesalePrice: l.product.wholesalePrice,
                                totalCost: l.totalCost,
                                discount: l.discount ?? 0,
                                quantity: l.quantity,
                                status: l.status,
                                priority: l.priority ?? "NORMAL",
                                notes: l.notes,
                                clientName: l.clientName,
                                clientPhone: l.clientPhone,
                                clientAddress: l.clientAddress,
                                deposit: l.deposit ?? null,
                                startedAt: l.startedAt,
                                deliveryDate: l.deliveryDate,
                                fabricLines: options.find((o) => o.id === l.product.id)?.fabricLines ?? [],
                                availableFabrics: fabrics,
                                nonFabricCost: options.find((o) => o.id === l.product.id)?.nonFabricCost ?? l.unitCost,
                              }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  /* ── Custom order row ── */
                  const o = row.data;
                  const subtotal  = o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                  const totalCost = o.items.reduce((s, i) => s + i.quantity * i.unitCost,  0);
                  const profit    = subtotal - totalCost;
                  const marginPct = subtotal > 0 ? (profit / subtotal) * 100 : 0;
                  const balance   = subtotal - o.deposit;
                  const totalQty  = o.items.reduce((s, i) => s + i.quantity, 0);
                  const firstItem = o.items[0];
                  const extraItems = o.items.length - 1;

                  return (
                    <TableRow key={`custom-${o.id}`} className="bg-violet-50/30 dark:bg-violet-950/10">
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            <FileText className="h-2.5 w-2.5" />
                            {o.invoiceNo}
                          </span>
                        </div>
                        {firstItem && (
                          <div className="mt-0.5 font-medium text-sm">{firstItem.name}</div>
                        )}
                        {extraItems > 0 && (
                          <div className="text-xs text-muted-foreground">+{extraItems} more item{extraItems === 1 ? "" : "s"}</div>
                        )}
                      </TableCell>

                      <TableCell>
                        <ClientCell name={o.clientName} phone={o.clientPhone} address={o.clientAddress} />
                      </TableCell>

                      <TableCell>
                        <DeliveryCell date={o.deliveryDate} status={o.status} />
                      </TableCell>

                      <TableCell>
                        <Badge variant={STATUS_VARIANT[o.status] ?? "secondary"}>{o.status.replace("_", " ")}</Badge>
                      </TableCell>

                      <TableCell className="text-right tabular-nums">{totalQty}</TableCell>

                      <TableCell className="text-right">
                        <div className="font-medium tabular-nums">{formatLE(subtotal)}</div>
                      </TableCell>

                      <TableCell className="text-right">
                        {totalCost > 0 ? (
                          <>
                            <div className="tabular-nums font-medium" style={{
                              color: profit <= 0 ? "#dc2626" : marginPct >= 25 ? "#16a34a" : marginPct >= 20 ? "#d97706" : "#dc2626",
                            }}>
                              {formatLE(profit)}
                            </div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">{marginPct.toFixed(1)}%</div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                        {o.deposit > 0 ? formatLE(o.deposit) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>

                      <TableCell className="text-right tabular-nums font-medium">
                        {balance <= 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">Paid</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">{formatLE(balance)}</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <CustomOrderRowActions
                          orderId={o.id}
                          invoiceNo={o.invoiceNo}
                          clientName={o.clientName}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                    Totals · {rows.length} order{rows.length === 1 ? "" : "s"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{totals.qty}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatLE(totals.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="tabular-nums font-semibold"
                      style={{
                        color:
                          totals.profit <= 0
                            ? "#dc2626"
                            : overallMarginPct >= 25
                              ? "#16a34a"
                              : overallMarginPct >= 20
                                ? "#d97706"
                                : "#dc2626",
                      }}
                    >
                      {formatLE(totals.profit)}
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {overallMarginPct.toFixed(1)}%
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {totals.deposit > 0 ? formatLE(totals.deposit) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {totals.remaining <= 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs">All paid</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">{formatLE(totals.remaining)}</span>
                    )}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
