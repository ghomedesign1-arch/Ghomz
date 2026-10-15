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

const CUSTOM_DATE_KEY = "shopify-orders.custom-date";

export function TomorrowQueue({
  todayDate,
  tomorrowDate,
  todayOrders,
  tomorrowOrders,
  allScheduledOrders,
}: {
  todayDate: string;
  tomorrowDate: string;
  todayOrders: TomorrowOrderEntry[];
  tomorrowOrders: TomorrowOrderEntry[];
  /** Every order with a scheduledFor set, so the client can filter to a
   *  user-picked custom date without a round-trip. Each entry carries its
   *  scheduledFor ISO date so we can bucket them client-side. */
  allScheduledOrders: (TomorrowOrderEntry & { scheduledFor: string })[];
}) {
  const [visible, setVisible] = React.useState(true);
  const [removing, setRemoving] = React.useState<number | null>(null);
  const [customDate, setCustomDate] = React.useState<string>("");
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "0") setVisible(false);
      const stored = localStorage.getItem(CUSTOM_DATE_KEY) ?? "";
      if (stored && stored !== todayDate && stored !== tomorrowDate) {
        setCustomDate(stored);
      }
    } catch {
      /* ignore */
    }
  }, [todayDate, tomorrowDate]);

  function updateCustomDate(iso: string) {
    setCustomDate(iso);
    try {
      if (iso) localStorage.setItem(CUSTOM_DATE_KEY, iso);
      else localStorage.removeItem(CUSTOM_DATE_KEY);
    } catch {
      /* ignore */
    }
  }

  const customOrders = React.useMemo(
    () =>
      customDate
        ? allScheduledOrders.filter((o) => o.scheduledFor === customDate)
        : [],
    [allScheduledOrders, customDate],
  );

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

  const totalOrders =
    todayOrders.length + tomorrowOrders.length + customOrders.length;
  const totalUnits =
    sumUnits(todayOrders) + sumUnits(tomorrowOrders) + sumUnits(customOrders);

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
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
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
            <CustomBucket
              date={customDate}
              onDateChange={updateCustomDate}
              orders={customOrders}
              removing={removing}
              onRemove={remove}
            />
          </div>
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

function CustomBucket({
  date,
  onDateChange,
  orders,
  removing,
  onRemove,
}: {
  date: string;
  onDateChange: (iso: string) => void;
  orders: TomorrowOrderEntry[];
  removing: number | null;
  onRemove: (id: number) => void;
}) {
  const pretty = date
    ? new Date(date).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "Pick a date";
  const units = sumUnits(orders);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40">
      <div className="flex items-baseline justify-between border-b border-amber-200 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <span>Custom date</span>
            {date && (
              <span className="text-xs font-normal text-amber-700">
                · {pretty}
              </span>
            )}
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="mt-1 h-7 w-full rounded-md border border-amber-300 bg-white px-2 text-xs"
          />
        </div>
        <div className="pl-3 text-right text-[11px] font-medium text-amber-800">
          {date && (
            <>
              {orders.length} order{orders.length === 1 ? "" : "s"} · {units}
              {" "}
              unit{units === 1 ? "" : "s"}
            </>
          )}
        </div>
      </div>

      {!date ? (
        <div className="p-4 text-center text-xs text-muted-foreground">
          Pick a date to see what&apos;s scheduled.
        </div>
      ) : orders.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground">
          Nothing scheduled for {pretty}.
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
