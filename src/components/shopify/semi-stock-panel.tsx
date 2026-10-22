"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Package } from "lucide-react";
import type { StockRow } from "@/lib/semi-stock";

const STORAGE_KEY = "shopify-orders.semi-stock-visible";

export function SemiStockPanel({ rows }: { rows: StockRow[] }) {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () =>
    setVisible((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });

  const short = rows.filter((r) => r.onHand < 0).length;
  const low = rows.filter((r) => r.onHand >= 0 && r.onHand <= r.lowStockAt).length;

  const activity = rows
    .flatMap((r) =>
      r.history.map((h) => ({ ...h, item: `${r.model} ${r.sizeCm}` })),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={visible}
        className="flex w-full items-center justify-between rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium hover:bg-violet-100"
      >
        <span className="inline-flex flex-wrap items-center gap-2">
          <Package className="h-4 w-4 text-violet-800" />
          Semi-finished stock
          <span className="rounded-full bg-violet-200 px-2 py-0.5 text-[10px] font-semibold text-violet-900">
            {rows.length} item{rows.length === 1 ? "" : "s"}
          </span>
          {short > 0 && (
            <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-900">
              {short} short
            </span>
          )}
          {low > 0 && (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              {low} low
            </span>
          )}
        </span>
        {visible ? (
          <ChevronUp className="h-4 w-4 text-violet-800" />
        ) : (
          <ChevronDown className="h-4 w-4 text-violet-800" />
        )}
      </button>

      {visible && (
        <div className="space-y-4 rounded-md border border-violet-200 bg-white p-3">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No stock items yet.{" "}
              <Link href="/semi-stock" className="text-violet-700 underline">
                Add your first one
              </Link>
              .
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {rows.map((r) => {
                  const tone =
                    r.onHand < 0
                      ? "border-rose-200 bg-rose-50 text-rose-800"
                      : r.onHand <= r.lowStockAt
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800";
                  return (
                    <div
                      key={r.id}
                      className={`rounded-md border px-3 py-1.5 text-xs ${tone}`}
                    >
                      <span className="font-medium">
                        {r.model} {r.sizeCm}
                      </span>{" "}
                      <span className="text-base font-bold tabular-nums">
                        {r.onHand}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent activity
                </div>
                {activity.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Nothing yet.</div>
                ) : (
                  <ul className="divide-y divide-border text-xs">
                    {activity.map((h, i) => (
                      <li key={i} className="flex justify-between gap-3 py-1.5">
                        <span>
                          <span className="text-muted-foreground">
                            {new Date(h.at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>{" "}
                          · <span className="font-medium">{h.item}</span> · {h.label}
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${h.delta < 0 ? "text-rose-700" : "text-emerald-700"}`}
                        >
                          {h.delta > 0 ? `+${h.delta}` : h.delta}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Link href="/semi-stock" className="text-xs text-violet-700 underline">
                Manage stock →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
