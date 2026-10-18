"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageCircle,
  X,
} from "lucide-react";
import { bilingualProduct, bilingualVariant } from "@/lib/translations";

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

  // Distinct dates that currently have scheduled orders, sorted ascending.
  const scheduledDates = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const o of allScheduledOrders) {
      map.set(o.scheduledFor, (map.get(o.scheduledFor) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([date, orderCount]) => ({ date, orderCount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allScheduledOrders]);

  React.useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "0") setVisible(false);
      const stored = localStorage.getItem(CUSTOM_DATE_KEY) ?? "";
      if (stored) {
        setCustomDate(stored);
        return;
      }
    } catch {
      /* ignore */
    }
    // No stored date — default to the nearest upcoming scheduled date (or
    // the earliest one if everything is already in the past) so users
    // immediately see what's scheduled without having to pick a date.
    if (scheduledDates.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const upcoming =
        scheduledDates.find((d) => d.date >= todayStr) ?? scheduledDates[0];
      setCustomDate(upcoming.date);
    }
  }, [scheduledDates]);

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

  const totalOrders = customOrders.length;
  const totalUnits = sumUnits(customOrders);

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
          Scheduled production
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
        <div className="space-y-2">
          {scheduledDates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {scheduledDates.map((d) => {
                const active = d.date === customDate;
                const pretty = new Date(d.date).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                });
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => updateCustomDate(d.date)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${
                      active
                        ? "border-amber-500 bg-amber-200 text-amber-900"
                        : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    }`}
                  >
                    <CalendarClock className="h-3 w-3" />
                    {pretty}
                    <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900">
                      {d.orderCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <CustomBucket
            date={customDate}
            onDateChange={updateCustomDate}
            orders={customOrders}
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

  const workOrderText = React.useMemo(() => {
    if (!orders.length) return "";
    const d = new Date(date);
    const prettyAr = isNaN(d.getTime())
      ? pretty
      : new Intl.DateTimeFormat("ar-EG", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(d);
    const lines: string[] = [];
    lines.push(`G-Homz Production — ${pretty}`);
    lines.push(`جدول الإنتاج — ${prettyAr}`);
    lines.push("");
    lines.push(`Scheduled date / تاريخ الإنتاج: ${pretty} / ${prettyAr}`);
    lines.push("");
    lines.push("Please produce / برجاء التصنيع:");
    for (const o of orders) {
      lines.push("");
      lines.push(`Order ${o.name} · ${o.customer}`);
      for (const it of o.items) {
        const name = bilingualProduct(it.title);
        const variant = it.variant ? ` — ${bilingualVariant(it.variant)}` : "";
        lines.push(`  • ${it.quantity}× ${name}${variant}`);
      }
    }
    lines.push("");
    lines.push(`Total units / إجمالي الوحدات: ${units}`);
    return lines.join("\n");
  }, [orders, pretty, units]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(workOrderText);
      toast.success("Production list copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  function whatsApp() {
    const link = `https://wa.me/?text=${encodeURIComponent(workOrderText)}`;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes("Mac") && "ontouchend" in document);
    if (isIOS) {
      toast(
        <div className="space-y-2">
          <div className="text-sm font-medium">Production list ready</div>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
          >
            Tap to open WhatsApp
          </a>
        </div>,
        { duration: 30_000 },
      );
      return;
    }
    const w = window.open(link, "_blank", "noopener,noreferrer");
    if (!w) {
      toast(
        <div className="space-y-2">
          <div className="text-sm font-medium">Popup blocked</div>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
          >
            Tap to open WhatsApp
          </a>
        </div>,
        { duration: 30_000 },
      );
    }
  }
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

      {date && orders.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-amber-200 px-3 py-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
          <button
            type="button"
            onClick={whatsApp}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-400 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
          >
            <MessageCircle className="h-3 w-3" />
            WhatsApp
          </button>
        </div>
      )}

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
