"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";

interface LatestOrder {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  currency: string;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

const LAST_SEEN_KEY = "shopify-orders.lastSeenCreatedAt";
const NOTIFY_PERMISSION_KEY = "shopify-orders.notifyAsked";
const POLL_MS = 60_000;

/**
 * Watches for new Shopify orders by polling /latest once a minute.
 *
 * The newest-seen timestamp lives in localStorage so returning sessions keep
 * their place. On new orders we fire a toast, play a short beep and (if the
 * user has granted it) a browser desktop notification. The user can toggle
 * sound + notifications from the bell button.
 */
export function NewOrdersWatcher() {
  const [lastSeen, setLastSeen] = React.useState<string>(() => {
    if (typeof window === "undefined") return new Date().toISOString();
    try {
      return (
        localStorage.getItem(LAST_SEEN_KEY) ??
        new Date().toISOString()
      );
    } catch {
      return new Date().toISOString();
    }
  });
  const [pending, setPending] = React.useState<LatestOrder[]>([]);
  const [enabled, setEnabled] = React.useState<boolean>(true);
  const beepRef = React.useRef<AudioContext | null>(null);

  const playBeep = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      beepRef.current = beepRef.current ?? new AudioContext();
      const ctx = beepRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      /* no-op */
    }
  }, []);

  // Ask for notification permission once.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (localStorage.getItem(NOTIFY_PERMISSION_KEY)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().finally(() => {
        try {
          localStorage.setItem(NOTIFY_PERMISSION_KEY, "1");
        } catch {
          /* ignore */
        }
      });
    }
  }, []);

  // Polling loop.
  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function tick() {
      try {
        const url = new URL("/api/shopify/orders/latest", window.location.origin);
        url.searchParams.set("since", lastSeen);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return;
        const data: { orders: LatestOrder[] } = await res.json();
        if (cancelled) return;
        if (data.orders.length === 0) return;
        // Filter strictly > lastSeen (Shopify returns >= created_at_min).
        const seenMs = new Date(lastSeen).getTime();
        const fresh = data.orders.filter(
          (o) => new Date(o.created_at).getTime() > seenMs,
        );
        if (fresh.length === 0) return;
        setPending((prev) => [...fresh, ...prev].slice(0, 20));
        notifyUser(fresh);
      } catch {
        /* network blip, try again next tick */
      }
    }
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [lastSeen, enabled]);

  function notifyUser(orders: LatestOrder[]) {
    const first = orders[0];
    const name =
      [first.customer?.first_name, first.customer?.last_name]
        .filter(Boolean)
        .join(" ") || "a customer";
    const summary =
      orders.length === 1
        ? `New order ${first.name} from ${name}`
        : `${orders.length} new orders · newest ${first.name}`;
    toast.success(summary, {
      action: {
        label: "Mark all seen",
        onClick: dismissAll,
      },
      duration: 20_000,
    });
    playBeep();
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        const notif = new Notification(
          orders.length === 1 ? "New Shopify order" : `${orders.length} new orders`,
          {
            body: summary,
            icon: "/favicon.ico",
            tag: "shopify-order",
          },
        );
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch {
        /* ignore */
      }
    }
  }

  function dismissAll() {
    const newest = pending[0];
    if (newest) {
      try {
        localStorage.setItem(LAST_SEEN_KEY, newest.created_at);
      } catch {
        /* ignore */
      }
      setLastSeen(newest.created_at);
    }
    setPending([]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setEnabled((e) => !e)}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
            enabled
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          title={enabled ? "Mute new-order alerts" : "Enable new-order alerts"}
        >
          {enabled ? (
            <>
              <Bell className="h-3 w-3" /> Alerts on
            </>
          ) : (
            <>
              <BellOff className="h-3 w-3" /> Alerts muted
            </>
          )}
        </button>
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-emerald-900">
            <span>
              {pending.length} new order{pending.length === 1 ? "" : "s"} since
              your last visit
            </span>
            <button
              type="button"
              onClick={dismissAll}
              className="text-xs font-normal text-emerald-700 underline-offset-2 hover:underline"
            >
              Mark all seen
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {pending.slice(0, 5).map((o) => {
              const name =
                [o.customer?.first_name, o.customer?.last_name]
                  .filter(Boolean)
                  .join(" ") || "Guest";
              return (
                <li key={o.id} className="flex items-center justify-between">
                  <span>
                    <Link
                      href={`#order-${o.id}`}
                      className="font-medium hover:underline"
                    >
                      {o.name}
                    </Link>{" "}
                    · {name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Number(o.total_price).toLocaleString("en-EG", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    {o.currency}
                  </span>
                </li>
              );
            })}
            {pending.length > 5 && (
              <li className="text-xs text-muted-foreground">
                … and {pending.length - 5} more. Reload to see all.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
