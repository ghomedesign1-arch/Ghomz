import { Suspense } from "react";
import {
  AlertTriangle,
  Banknote,
  Factory,
  PackageCheck,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { MaterialMixChart } from "@/components/dashboard/material-mix-chart";
import { FabricUsageChart } from "@/components/dashboard/fabric-usage-chart";
import { KpiRangePicker } from "@/components/dashboard/kpi-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatLE } from "@/lib/costing";
import { cn, formatNumber, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseMonthKey(raw: string | undefined, fallbackOffset = 0) {
  const now = new Date();
  if (raw && /^\d{4}-\d{1,2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    if (!isNaN(y) && m >= 0 && m <= 11) return { year: y, month: m, key: raw };
  }
  const d = new Date(now.getFullYear(), now.getMonth() + fallbackOffset, 1);
  return { year: d.getFullYear(), month: d.getMonth(), key: `${d.getFullYear()}-${d.getMonth()}` };
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams?: { kpiFrom?: string; kpiTo?: string; kpiMonth?: string };
}) {
  const now = new Date();
  const defaultKey = `${now.getFullYear()}-${now.getMonth()}`;

  // Support both old single-month (?kpiMonth=) and new range (?kpiFrom=&kpiTo=)
  const rawFrom = searchParams?.kpiFrom ?? searchParams?.kpiMonth;
  const rawTo   = searchParams?.kpiTo   ?? searchParams?.kpiMonth;

  const from = parseMonthKey(rawFrom);
  const to   = parseMonthKey(rawTo);

  // Ensure from <= to
  const fromDate = new Date(from.year, from.month, 1);
  const toDate   = new Date(to.year,   to.month,   1);
  const [kpiStart, kpiEnd] = fromDate <= toDate
    ? [fromDate, new Date(to.year, to.month + 1, 1)]
    : [toDate,   new Date(from.year, from.month + 1, 1)];

  const rangeValue = fromDate <= toDate
    ? { from: from.key, to: to.key }
    : { from: to.key,   to: from.key };

  const data = await getDashboardData(6, undefined, undefined, kpiStart, kpiEnd);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome back, Ahmed"
        description="Live snapshot of G-Homz production, material consumption and product profitability."
        actions={
          !data.ready && (
            <div className="flex flex-col items-end gap-1">
              <Badge variant="warning" className="gap-1.5">
                <AlertTriangle className="h-3 w-3" /> Demo mode (no DB connected)
              </Badge>
              {data.dbError && (
                <span className="max-w-sm truncate text-right text-[10px] text-destructive" title={data.dbError}>
                  Error: {data.dbError}
                </span>
              )}
            </div>
          )
        }
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing KPIs for{" "}
          <span className="font-medium text-foreground">{data.kpiMonthLabel}</span>
        </p>
        <Suspense>
          <KpiRangePicker value={rangeValue} />
        </Suspense>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          index={0}
          label={`Revenue · ${data.kpiMonthLabel}`}
          value={formatLE(data.kpis.revenueMTD)}
          icon={<Banknote className="h-5 w-5" />}
          hint="Actual order value after discounts"
        />
        <KpiCard
          index={1}
          label={`Profit · ${data.kpiMonthLabel}`}
          value={formatLE(data.kpis.profitMTD)}
          icon={<TrendingUp className="h-5 w-5" />}
          hint={`${data.kpis.marginMTD.toFixed(1)}% margin · revenue minus BOM cost`}
          highlight={data.kpis.marginMTD >= 25 ? "green" : data.kpis.marginMTD >= 20 ? "amber" : "red"}
        />
        <KpiCard
          index={2}
          label={`Purchases · ${data.kpiMonthLabel}`}
          value={formatLE(data.kpis.materialCostMTD)}
          icon={<ShoppingCart className="h-5 w-5" />}
          hint={`${data.kpis.purchaseCountMTD} purchase order${data.kpis.purchaseCountMTD === 1 ? "" : "s"}`}
        />
        <KpiCard
          index={3}
          label="Open orders"
          value={formatNumber(data.kpis.openOrders)}
          icon={<PackageCheck className="h-5 w-5" />}
          hint="In progress / draft"
        />
        <KpiCard
          index={4}
          label="Active products"
          value={formatNumber(data.kpis.activeProducts)}
          icon={<Factory className="h-5 w-5" />}
          hint={`${data.kpis.lowStockCount} low-stock alerts`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>Revenue vs material cost</CardTitle>
              <CardDescription>
                Revenue = production orders × retail price · Cost = purchase spend
              </CardDescription>
            </div>
            <div className="flex gap-2 text-xs">
              <Legend dot="hsl(var(--chart-1))" label="Revenue" />
              <Legend dot="hsl(var(--chart-3))" label="Material cost" />
            </div>
          </CardHeader>
          <CardContent>
            <RevenueChart data={data.revenueByMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost mix</CardTitle>
            <CardDescription>Where every EGP of production goes</CardDescription>
          </CardHeader>
          <CardContent>
            <MaterialMixChart data={data.materialMix} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Most profitable products</CardTitle>
            <CardDescription>
              Retail price vs computed unit cost. Margin is profit / retail.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Retail</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topProducts.map((p) => (
                  <TableRow key={p.sku}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatLE(p.retail)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatLE(p.cost)}
                    </TableCell>
                    <TableCell
                      className="text-right tabular-nums font-semibold"
                      style={{
                        color: p.margin < 20 ? "#dc2626"
                          : p.margin < 30 ? "#d97706"
                          : "#16a34a",
                      }}
                    >
                      {formatLE(p.profit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          background: p.margin < 20 ? "#fee2e2"
                            : p.margin < 30 ? "#fef3c7"
                            : "#dcfce7",
                          color: p.margin < 20 ? "#dc2626"
                            : p.margin < 30 ? "#d97706"
                            : "#16a34a",
                        }}
                      >
                        {pct(p.margin)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low stock alerts
            </CardTitle>
            <CardDescription>Items below reorder threshold</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.lowStock.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <PackageCheck className="h-4 w-4" />
                Inventory is healthy across all SKUs.
              </div>
            ) : (
              data.lowStock.map((item) => (
                <div
                  key={`${item.kind}-${item.name}`}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.kind}
                    </div>
                  </div>
                  <Badge variant="warning">{item.left}</Badge>
                </div>
              ))
            )}
            <Separator />
            <p className="text-xs text-muted-foreground">
              Thresholds: sponges ≤ 3 blocks · fabrics & bulk ≤ reorder level.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fabric stock on hand</CardTitle>
          <CardDescription>
            Meters available across active collections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FabricUsageChart data={data.fabricUsage} />
        </CardContent>
      </Card>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: dot }}
      />
      {label}
    </div>
  );
}
