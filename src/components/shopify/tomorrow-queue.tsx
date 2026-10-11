"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarClock, ChevronDown, ChevronUp, X } from "lucide-react";

export interface TomorrowOrderEntry {
  id: number;
  name: string;
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
  todayDate,
  tomorrowDate,
  todayOrders,
  tomorrowOrders,
}: {
  todayDate: string;
  tomorrowDate: string;
  todayOrders: TomorrowOrderEntry[];
  tomorrowOrders: TomorrowOrderEntry[];
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
      toast.success("Removed from plan");
      window.location.reload();
    } finally {
      setRemoving(null);
    }
  }

  const totalOrders = todayOrders.length + tomorrowOrders.length;
  const totalUnits =
    sumUnits(todayOrders) + sumUnits(tomorrowOrders);

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
          Today &amp; tomorrow&apos;s production
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
            {totalOrders} order{totalOrders === 1 ? "" : "s"} · {totalUnits}{" "}
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
        <div className="grid gap-3 md:grid-cols-2">
          <DayBucket
            dateIso={todayDate}
            title="Today"
            orders={todayOrders}
            removing={removing}
            onRemove={remove}
          />
          <DayBucket
            dateIso={tomorrowDate}
            title="Tomorrow"
            orders={tomorrowOrders}
            removing={removing}
            onRemove={remove}
          />
        </div>
      )}
    </div>
  );
}

function DayBucket({
  dateIso,
  title,
  orders,
  removing,
  onRemove,
}: {
  dateIso: string;
  title: string;
  orders: TomorrowOrderEntry[];
  removing: number | null;
  onRemove: (id: number) => void;
}) {
  const pretty = new Date(dateIso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const units = sumUnits(orders);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40">
      <div className="flex items-baseline justify-between border-b border-amber-200 px-3 py-2">
        <div className="text-sm font-semibold text-amber-900">
          {title} <span className="text-xs font-normal text-amber-700">· {pretty}</span>
        </div>
        <div className="text-[11px] font-medium text-amber-800">
          {orders.length} order{orders.length === 1 ? "" : "s"} · {units} unit
          {units === 1 ? "" : "s"}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground">
          Nothing scheduled for {title.toLowerCase()}.
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
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(o.id)}
                disabled={removing === o.id}
                className="shrink-0 rounded-full p-1 text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function sumUnits(orders: TomorrowOrderEntry[]): number {
  return orders.reduce(
    (a, o) => a + o.items.reduce((b, i) => b + i.quantity, 0),
    0,
  );
}
