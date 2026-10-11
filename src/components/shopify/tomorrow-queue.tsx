"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarClock, ChevronDown, ChevronUp, X } from "lucide-react";

export interface TomorrowOrderEntry {
  id: number;
  name: string; // order #
  customer: string;
  items: {
    title: string;
    variant: string | null;
    sku: string | null;
    quantity: number;
  }[];
}

const STORAGE_KEY = "shopify-orders.tomorrow-visible";

export function TomorrowQueue({
  tomorrowDate,
  orders,
}: {
  tomorrowDate: string;
  orders: TomorrowOrderEntry[];
}) {
  const [visible, setVisible] = React.useState(true);
  const [removing, setRemoving] = React.useState<number | null>(null);
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

  async function remove(orderId: number) {
    setRemoving(orderId);
    try {
      const res = await fetch(`/api/shopify/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledFor: null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Remove failed");
        return;
      }
      toast.success("Removed from tomorrow's plan");
      // Re-render the page so the section updates.
      window.location.reload();
    } finally {
      setRemoving(null);
    }
  }

  const totalUnits = orders.reduce(
    (a, o) => a + o.items.reduce((b, i) => b + i.quantity, 0),
    0,
  );
  const prettyDate = new Date(tomorrowDate).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={visible}
        className="flex w-full items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium hover:bg-amber-100"
      >
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-amber-700" />
          Tomorrow&apos;s production
          <span className="text-xs font-normal text-amber-800">
            · {prettyDate}
          </span>
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
            {orders.length} order{orders.length === 1 ? "" : "s"} · {totalUnits}{" "}
            unit{totalUnits === 1 ? "" : "s"}
          </span>
        </span>
        {visible ? (
          <ChevronUp className="h-4 w-4 text-amber-800" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-800" />
        )}
      </button>

      {visible && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40">
          {orders.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nothing scheduled for tomorrow. Add an order from the list below
              using its{" "}
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                + Tomorrow
              </span>{" "}
              button.
            </div>
          ) : (
            <div className="divide-y divide-amber-200">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-start justify-between gap-3 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span>{o.name}</span>
                      <span className="text-muted-foreground">
                        · {o.customer}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {o.items.map((it, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium">×{it.quantity}</span>{" "}
                          <span>{it.title}</span>
                          {it.variant && (
                            <span className="text-muted-foreground">
                              {" "}
                              — {it.variant}
                            </span>
                          )}
                          {it.sku && (
                            <span className="text-[11px] text-muted-foreground">
                              {" "}
                              ({it.sku})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(o.id)}
                    disabled={removing === o.id}
                    className="shrink-0 rounded-full p-1 text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                    aria-label="Remove from tomorrow's plan"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
