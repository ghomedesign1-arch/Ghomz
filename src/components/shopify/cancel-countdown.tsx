"use client";

import * as React from "react";
import { AlarmClock, Ban, ExternalLink, X } from "lucide-react";

/** Re-renders every 30s so countdowns stay current without a page reload. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatLeft(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Ticket badge: small pill that counts down 24h; tap it for the actions. */
export function CancelCountdownBadge({
  deadline,
  shopUrl,
  busy,
  onMarkCancelled,
  onStop,
}: {
  deadline: string;
  shopUrl: string;
  busy: boolean;
  onMarkCancelled: () => void;
  onStop: () => void;
}) {
  const now = useNow();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);
  const left = new Date(deadline).getTime() - now;
  const due = left <= 0;

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const itemCls =
    "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary disabled:opacity-50";

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`24h after the cancellation message · ${new Date(deadline).toLocaleString("en-GB")}`}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
          due
            ? "border-rose-600 bg-rose-600 text-white"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}
      >
        <AlarmClock className="h-3 w-3" />
        {due ? "Cancel now" : `Cancel ${formatLeft(left)}`}
      </button>
      {open && (
        <span className="absolute left-0 top-full z-20 mt-1 block w-44 rounded-lg border bg-popover p-1 font-sans text-foreground shadow-lg">
          <a
            href={shopUrl}
            target="_blank"
            rel="noreferrer"
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="h-3 w-3" /> Open in Shopify
          </a>
          <button
            type="button"
            disabled={busy}
            className={itemCls}
            onClick={() => {
              setOpen(false);
              onMarkCancelled();
            }}
          >
            <Ban className="h-3 w-3" /> Mark cancelled
          </button>
          <button
            type="button"
            disabled={busy}
            className={itemCls}
            onClick={() => {
              setOpen(false);
              if (confirm("Stop the 24h timer? (e.g. the customer replied)")) onStop();
            }}
          >
            <X className="h-3 w-3" /> Stop timer (customer replied)
          </button>
        </span>
      )}
    </span>
  );
}

export interface CancelWatchEntry {
  id: number;
  name: string;
  customer: string;
  deadline: string;
  shopUrl: string;
}

/** Page alert: lists orders whose 24h is over and waiting to be cancelled. */
export function CancelAlerts({ entries }: { entries: CancelWatchEntry[] }) {
  const now = useNow();
  if (entries.length === 0) return null;
  const due = entries.filter((e) => new Date(e.deadline).getTime() <= now);
  const waiting = entries.length - due.length;

  if (due.length === 0) {
    const next = Math.min(...entries.map((e) => new Date(e.deadline).getTime()));
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
        <AlarmClock className="h-4 w-4" />
        {waiting} order{waiting === 1 ? "" : "s"} waiting 24h after the cancellation
        message · next in {formatLeft(next - now)}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 font-semibold text-rose-800">
        <AlarmClock className="h-4 w-4" />
        {due.length} order{due.length === 1 ? "" : "s"} ready to cancel in Shopify
        (24h passed)
        {waiting > 0 && (
          <span className="font-normal text-rose-700">· {waiting} still waiting</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {due.map((e) => (
          <a
            key={e.id}
            href={e.shopUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700"
          >
            {e.name} · {e.customer}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    </div>
  );
}
