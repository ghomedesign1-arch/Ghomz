"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Wallet } from "lucide-react";

interface RevenueSummaryProps {
  expected: number;
  collected: number;
  outstanding: number;
  currency: string | null;
  orderCount: number;
}

const STORAGE_KEY = "shopify-orders.revenue-visible";

export function RevenueSummary({
  expected,
  collected,
  outstanding,
  currency,
  orderCount,
}: RevenueSummaryProps) {
  // Default: visible. Hydrates from localStorage on mount.
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "0") setVisible(false);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    setVisible((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const pct =
    expected > 0 ? `${Math.round((collected / expected) * 100)}% of expected` : "—";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={visible}
        className="flex w-full items-center justify-between rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm font-medium hover:bg-secondary"
      >
        <span className="inline-flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          Revenue summary
          {!visible && (
            <span className="text-xs font-normal text-muted-foreground">
              — hidden
            </span>
          )}
        </span>
        {visible ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {visible && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile
            label="Expected total"
            value={expected}
            currency={currency}
            tone="border-slate-300 bg-slate-50 text-slate-900"
            hint={`${orderCount} orders`}
          />
          <Tile
            label="Collected"
            value={collected}
            currency={currency}
            tone="border-emerald-200 bg-emerald-50 text-emerald-900"
            hint={pct}
          />
          <Tile
            label="Outstanding"
            value={outstanding}
            currency={currency}
            tone="border-rose-200 bg-rose-50 text-rose-900"
            hint="Still to collect"
          />
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  currency,
  tone,
  hint,
}: {
  label: string;
  value: number;
  currency: string | null;
  tone: string;
  hint?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
        {value.toLocaleString("en-EG", { maximumFractionDigits: 0 })}{" "}
        <span className="text-sm font-medium opacity-70">{currency ?? ""}</span>
      </div>
      {hint && <div className="mt-1 text-xs opacity-60">{hint}</div>}
    </div>
  );
}
