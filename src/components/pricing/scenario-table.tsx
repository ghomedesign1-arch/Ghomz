"use client";

import * as React from "react";
import { Plus, RotateCcw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatLE } from "@/lib/costing";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Selling price required to achieve a given margin on a known cost */
function priceAtMargin(cost: number, marginPct: number) {
  if (marginPct >= 100 || cost <= 0) return Infinity;
  return cost / (1 - marginPct / 100);
}

/** Actual margin % of a selling price vs cost */
function actualMargin(cost: number, price: number) {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

function fmt(n: number) {
  if (!isFinite(n)) return "∞";
  return formatLE(Math.round(n));
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

const DEFAULT_SCENARIOS = [15, 20, 25, 30, 35, 40];

// ── types ─────────────────────────────────────────────────────────────────────

export interface ProductRow {
  id:             string;
  sku:            string;
  name:           string;
  cost:           number;
  retailPrice:    number;
  wholesalePrice: number;
}

// ── component ─────────────────────────────────────────────────────────────────

export function ScenarioTable({ products }: { products: ProductRow[] }) {
  const [margins, setMargins] = React.useState<number[]>(DEFAULT_SCENARIOS);
  const [editing, setEditing] = React.useState<number | null>(null); // index of scenario being edited
  const [editVal, setEditVal] = React.useState("");

  // ── scenario management ───────────────────────────────────────────────────

  function addScenario() {
    const next = Math.min(...margins) - 5;
    const clamped = Math.max(1, next);
    setMargins((prev) => [...prev, clamped].sort((a, b) => a - b));
  }

  function removeScenario(i: number) {
    if (margins.length <= 1) return;
    setMargins((prev) => prev.filter((_, idx) => idx !== i));
  }

  function startEdit(i: number) {
    setEditing(i);
    setEditVal(String(margins[i]));
  }

  function commitEdit(i: number) {
    const v = parseFloat(editVal);
    if (!isNaN(v) && v > 0 && v < 100) {
      setMargins((prev) => {
        const next = [...prev];
        next[i] = v;
        return next.slice().sort((a, b) => a - b);
      });
    }
    setEditing(null);
  }

  function reset() {
    setMargins(DEFAULT_SCENARIOS);
  }

  // ── summary stats ─────────────────────────────────────────────────────────

  const avgRetailMargin = products.length
    ? products.reduce((s, p) => s + actualMargin(p.cost, p.retailPrice), 0) / products.length
    : 0;
  const avgCost = products.length
    ? products.reduce((s, p) => s + p.cost, 0) / products.length
    : 0;

  // ── render ────────────────────────────────────────────────────────────────

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No products yet. Add products with a cost to use the scenario simulator.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          label="Products"
          value={String(products.length)}
          sub="in catalog"
        />
        <SummaryCard
          label="Avg cost"
          value={fmt(avgCost)}
          sub="per unit (BOM)"
        />
        <SummaryCard
          label="Avg retail margin"
          value={pct(avgRetailMargin)}
          sub="current prices"
          highlight={avgRetailMargin >= 25 ? "green" : avgRetailMargin >= 20 ? "amber" : "red"}
        />
        <SummaryCard
          label="Scenarios"
          value={String(margins.length)}
          sub="margin targets"
        />
      </div>

      {/* ── Scenario builder controls ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Margin scenarios</CardTitle>
              <CardDescription>
                Click a % header to edit it. Each column shows the required selling price to hit that margin.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={addScenario} disabled={margins.length >= 10}>
                <Plus className="h-3.5 w-3.5" /> Add scenario
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-6 py-3 text-left font-semibold text-muted-foreground w-[220px]">Product</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground whitespace-nowrap">BOM cost</th>
                {margins.map((m, i) => (
                  <th key={i} className="px-3 py-2 text-right min-w-[110px]">
                    {editing === i ? (
                      <input
                        className="w-16 rounded border px-1.5 py-0.5 text-right text-xs font-medium focus:outline-none focus:ring-1 focus:ring-foreground"
                        value={editVal}
                        autoFocus
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={() => commitEdit(i)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(i);
                          if (e.key === "Escape") setEditing(null);
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(i)}
                        className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                      >
                        {m}%
                        {margins.length > 1 && (
                          <span
                            onClick={(e) => { e.stopPropagation(); removeScenario(i); }}
                            className="hidden group-hover:inline text-muted-foreground hover:text-destructive ml-0.5"
                          >
                            ×
                          </span>
                        )}
                      </button>
                    )}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground whitespace-nowrap min-w-[130px]">
                  Retail now
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground whitespace-nowrap min-w-[130px]">
                  Wholesale now
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const retMargin  = actualMargin(p.cost, p.retailPrice);
                const wholMargin = actualMargin(p.cost, p.wholesalePrice);

                return (
                  <tr key={p.id} className="border-b hover:bg-muted/20 transition-colors">
                    {/* Product */}
                    <td className="px-6 py-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.sku}</div>
                    </td>

                    {/* BOM cost */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {fmt(p.cost)}
                    </td>

                    {/* Scenario columns */}
                    {margins.map((m, i) => {
                      const target = priceAtMargin(p.cost, m);
                      const diffVsRetail = p.retailPrice - target;
                      // How does current retail compare to this scenario?
                      const retAbove = diffVsRetail > 0.5;
                      const retBelow = diffVsRetail < -0.5;

                      return (
                        <td key={i} className="px-3 py-3 text-right">
                          <div className="tabular-nums font-medium">{fmt(target)}</div>
                          {/* Show profit at this price */}
                          <div className="text-[10px] text-muted-foreground tabular-nums">
                            profit {fmt(target - p.cost)}
                          </div>
                        </td>
                      );
                    })}

                    {/* Current retail */}
                    <td className="px-4 py-3 text-right">
                      {p.retailPrice > 0 ? (
                        <>
                          <div className="tabular-nums font-medium">{fmt(p.retailPrice)}</div>
                          <MarginBadge margin={retMargin} />
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not set</span>
                      )}
                    </td>

                    {/* Current wholesale */}
                    <td className="px-4 py-3 text-right">
                      {p.wholesalePrice > 0 ? (
                        <>
                          <div className="tabular-nums font-medium">{fmt(p.wholesalePrice)}</div>
                          <MarginBadge margin={wholMargin} />
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not set</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── Margin guide ── */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How margin works</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>
            <strong className="text-foreground">Margin %</strong> = (Price − Cost) ÷ Price × 100 &nbsp;·&nbsp;
            This tells you what percentage of each sale is profit.
          </p>
          <p>
            <strong className="text-foreground">Required price</strong> = Cost ÷ (1 − Margin%) &nbsp;·&nbsp;
            E.g. at 30% margin on EGP 10,000 cost → EGP 10,000 ÷ 0.70 = <strong className="text-foreground">EGP 14,286</strong>
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <LegendItem color="red"    label="Below 20% — low margin" />
            <LegendItem color="amber"  label="20–24% — acceptable" />
            <LegendItem color="green"  label="25%+ — healthy margin" />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function MarginBadge({ margin }: { margin: number }) {
  const color =
    margin < 20 ? { bg: "#fee2e2", text: "#dc2626" }
    : margin < 25 ? { bg: "#fef3c7", text: "#d97706" }
    : { bg: "#dcfce7", text: "#16a34a" };

  return (
    <div
      className="mt-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums"
      style={{ background: color.bg, color: color.text }}
    >
      {margin >= 25 ? <TrendingUp className="h-2.5 w-2.5" />
        : margin >= 20 ? <Minus className="h-2.5 w-2.5" />
        : <TrendingDown className="h-2.5 w-2.5" />}
      {margin.toFixed(1)}%
    </div>
  );
}

function SummaryCard({
  label, value, sub, highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: "green" | "amber" | "red";
}) {
  const valueColor =
    highlight === "green" ? "#16a34a"
    : highlight === "amber" ? "#d97706"
    : highlight === "red"   ? "#dc2626"
    : undefined;

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: "red" | "amber" | "green"; label: string }) {
  const bg = color === "red" ? "#fee2e2" : color === "amber" ? "#fef3c7" : "#dcfce7";
  const text = color === "red" ? "#dc2626" : color === "amber" ? "#d97706" : "#16a34a";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: bg, border: `1px solid ${text}` }} />
      <span style={{ color: text }}>{label}</span>
    </span>
  );
}
