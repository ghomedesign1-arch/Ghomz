"use client";

import * as React from "react";
import { AlarmClock, ExternalLink, X } from "lucide-react";

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

/** Ticket badge: counts down 24h after the cancellation notice, then turns red. */
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
  const left = new Date(deadline).getTime() - now;
  const due = left <= 0;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        due
          ? "animate-pulse border-rose-400 bg-rose-600 text-white"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
      title={`24h after the cancellation message · ${new Date(deadline).toLocaleString("en-GB")}`}
    >
      <AlarmClock className="h-3 w-3" />
      {due ? "24h passed — cancel now" : `Cancel in ${formatLeft(left)}`}
      {due && (
        <>
          <a
            href={shopUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 hover:bg-white/30"
          >
            Shopify <ExternalLink className="h-2.5 w-2.5" />
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={onMarkCancelled}
            className="rounded-full bg-white/20 px-1.5 hover:bg-white/30"
          >
            Mark cancelled
          </button>
        </>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (confirm("Stop the 24h timer? (e.g. the customer replied)")) onStop();
        }}
        title="Stop timer — customer replied"
        className="rounded-full p-0.5 hover:bg-black/10"
      >
        <X className="h-3 w-3" />
      </button>
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
