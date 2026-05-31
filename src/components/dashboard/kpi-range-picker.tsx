"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// ── helpers ──────────────────────────────────────────────────────────────────

/** "YYYY-M" for a given offset from today (0 = this month, -1 = last month…) */
function monthKey(offset: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function buildMonthOptions(count = 24) {
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const key = monthKey(-i);
    options.push({ value: key, label: monthLabel(key) });
  }
  return options;
}

const MONTH_OPTIONS = buildMonthOptions(24);

const PRESETS = [
  { label: "This month",   from: 0,   to: 0 },
  { label: "Last 2 months", from: -1, to: 0 },
  { label: "Last 3 months", from: -2, to: 0 },
  { label: "Last 6 months", from: -5, to: 0 },
  { label: "This year",    from: null, to: null }, // special
];

function thisYearKeys() {
  const now = new Date();
  const from = `${now.getFullYear()}-0`;
  const to   = `${now.getFullYear()}-${now.getMonth()}`;
  return { from, to };
}

// ── component ─────────────────────────────────────────────────────────────────

export interface KpiRangeValue {
  from: string; // "YYYY-M"
  to: string;   // "YYYY-M"
}

interface KpiRangePickerProps {
  value: KpiRangeValue;
}

export function KpiRangePicker({ value }: KpiRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [customFrom, setCustomFrom] = React.useState(value.from);
  const [customTo, setCustomTo]     = React.useState(value.to);

  function applyRange(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("kpiMonth"); // remove old single-month param
    params.set("kpiFrom", from);
    params.set("kpiTo", to);
    router.replace(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function applyCustom() {
    // ensure from <= to
    const [fy, fm] = customFrom.split("-").map(Number);
    const [ty, tm] = customTo.split("-").map(Number);
    const fromDate = new Date(fy, fm, 1);
    const toDate   = new Date(ty, tm, 1);
    if (fromDate > toDate) {
      applyRange(customTo, customFrom); // swap
    } else {
      applyRange(customFrom, customTo);
    }
  }

  // Build display label
  const fromLabel = monthLabel(value.from);
  const toLabel   = monthLabel(value.to);
  const displayLabel = value.from === value.to
    ? fromLabel
    : `${new Date(...(value.from.split("-").map(Number) as [number, number, number])).toLocaleString("en-US", { month: "short", year: "numeric" })} – ${new Date(...(value.to.split("-").map(Number) as [number, number, number])).toLocaleString("en-US", { month: "short", year: "numeric" })}`;

  // Which preset is active?
  function isActivePreset(from: number | null, to: number | null) {
    if (from === null && to === null) {
      const yr = thisYearKeys();
      return value.from === yr.from && value.to === yr.to;
    }
    return value.from === monthKey(from!) && value.to === monthKey(to!);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex h-8 items-center gap-1.5 rounded-md border border-dashed bg-secondary px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{displayLabel}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-3 space-y-3">
        {/* ── Quick presets ── */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quick select
          </p>
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.map((p) => {
              const active = isActivePreset(p.from, p.to);
              return (
                <button
                  key={p.label}
                  onClick={() => {
                    if (p.from === null) {
                      const yr = thisYearKeys();
                      applyRange(yr.from, yr.to);
                    } else {
                      applyRange(monthKey(p.from), monthKey(p.to));
                    }
                  }}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium text-left transition-colors ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Custom range ── */}
        <div className="space-y-2 border-t pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Custom range
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">From</p>
              <Select value={customFrom} onValueChange={setCustomFrom}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">To</p>
              <Select value={customTo} onValueChange={setCustomTo}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" className="w-full h-8 text-xs" onClick={applyCustom}>
            Apply range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
