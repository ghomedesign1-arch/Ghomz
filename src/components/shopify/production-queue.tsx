"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Factory } from "lucide-react";

export interface ProductionQueueItem {
  title: string;
  variant: string | null;
  sku: string | null;
  quantity: number;
  orderCount: number;
}

const STORAGE_KEY = "shopify-orders.production-queue-visible";

export function ProductionQueue({
  items,
  totalUnits,
}: {
  items: ProductionQueueItem[];
  totalUnits: number;
}) {
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "0") setVisible(false);
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

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={visible}
        className="flex w-full items-center justify-between rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm font-medium hover:bg-secondary"
      >
        <span className="inline-flex items-center gap-2">
          <Factory className="h-4 w-4 text-muted-foreground" />
          Production queue
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            {totalUnits} unit{totalUnits === 1 ? "" : "s"}
          </span>
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
        <div className="rounded-xl border border-border bg-white">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nothing in the production queue 🎉
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{it.title}</div>
                    {it.variant && (
                      <div className="text-sm text-muted-foreground">
                        {it.variant}
                      </div>
                    )}
                    {it.sku && (
                      <div className="text-[11px] text-muted-foreground">
                        SKU: {it.sku}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-lg font-semibold">
                      ×{it.quantity}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      in {it.orderCount} order
                      {it.orderCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
