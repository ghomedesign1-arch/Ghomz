import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { MaterialMixChart } from "@/components/dashboard/material-mix-chart";
import { FabricUsageChart } from "@/components/dashboard/fabric-usage-chart";
import { ForecastChart } from "@/components/dashboard/forecast-chart";
import { RangePicker } from "@/components/dashboard/range-picker";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatLE } from "@/lib/costing";
import { buildForecastSeries } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: { months?: string };
}) {
  const months = Math.max(1, Math.min(24, Number(searchParams?.months) || 6));
  const data = await getDashboardData(months);
  const last = data.revenueByMonth.at(-1);
  const totalRevenue = data.revenueByMonth.reduce((a, m) => a + m.revenue, 0);
  const totalCost = data.revenueByMonth.reduce((a, m) => a + m.cost, 0);
  const grossMargin =
    totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

  const revenueHistory = data.revenueByMonth.map((m) => ({
    label: m.month,
    value: m.revenue,
  }));
  const costHistory = data.revenueByMonth.map((m) => ({
    label: m.month,
    value: m.cost,
  }));
  const revenueForecast = buildForecastSeries(revenueHistory, 3);
  const costForecast = buildForecastSeries(costHistory, 3);
  const lastActualLabel = data.revenueByMonth.at(-1)?.month;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Trend analysis on revenue, material consumption and cost mix."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label={`Revenue (${months}M)`} value={formatLE(totalRevenue)} />
        <Tile label={`Material cost (${months}M)`} value={formatLE(totalCost)} />
        <Tile label="Gross margin" value={`${grossMargin.toFixed(1)}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>Revenue vs cost</CardTitle>
              <CardDescription>Trailing {months} months</CardDescription>
            </div>
            <Suspense><RangePicker current={months} /></Suspense>
          </CardHeader>
          <CardContent>
            <RevenueChart data={data.revenueByMonth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cost composition</CardTitle>
            <CardDescription>
              Live mix from current product BOMs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MaterialMixChart data={data.materialMix} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue forecast</CardTitle>
            <CardDescription>
              Weighted moving average · next 3 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForecastChart
              data={revenueForecast}
              lastActualLabel={lastActualLabel}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Material cost forecast</CardTitle>
            <CardDescription>
              Same model, applied to historical raw-material consumption
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForecastChart
              data={costForecast}
              lastActualLabel={lastActualLabel}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fabric stock distribution</CardTitle>
          <CardDescription>Meters available per collection</CardDescription>
        </CardHeader>
        <CardContent>
          <FabricUsageChart data={data.fabricUsage} />
        </CardContent>
      </Card>

      {last && (
        <p className="text-xs text-muted-foreground">
          Latest month ({last.month}): revenue {formatLE(last.revenue)} · material
          cost {formatLE(last.cost)}.
        </p>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {value}
      </div>
    </Card>
  );
}
