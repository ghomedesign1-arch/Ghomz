"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, ChevronDown, ChevronUp, FileSpreadsheet } from "lucide-react";

export interface ProductFilterOption {
  /** Stable key: `${title}||${variant ?? ""}` */
  key: string;
  title: string;
  variant: string | null;
  count: number;
}

const STORAGE_KEY = "shopify-orders.product-filter-visible";

/**
 * Multi-select tile grid for filtering orders by product + variant. The
 * active selection is encoded in the URL as `products=key1|key2|…` so it
 * survives reloads and composes with the other filters.
 */
export function ProductFilter({ options }: { options: ProductFilterOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  const selected = React.useMemo(() => {
    const raw = params.get("products") ?? "";
    return new Set(raw ? raw.split("|").filter(Boolean) : []);
  }, [params]);

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const q = new URLSearchParams(params.toString());
    if (next.size === 0) q.delete("products");
    else q.set("products", Array.from(next).join("|"));
    router.push(`/shopify-orders?${q.toString()}`);
  }

  function clear() {
    const q = new URLSearchParams(params.toString());
    q.delete("products");
    router.push(`/shopify-orders?${q.toString()}`);
  }

  function toggleVisible() {
    setVisible((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (options.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggleVisible}
        aria-expanded={visible}
        className="flex w-full items-center justify-between rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm font-medium hover:bg-secondary"
      >
        <span className="inline-flex items-center gap-2">
          <Boxes className="h-4 w-4 text-muted-foreground" />
          Filter by product
          {selected.size > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {selected.size} selected
            </span>
          )}
          <span className="text-xs font-normal text-muted-foreground">
            {options.length} option{options.length === 1 ? "" : "s"}
          </span>
        </span>
        {visible ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {visible && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Link
              href={`/shopify-orders/work-order${
                selected.size > 0
                  ? `?products=${Array.from(selected).join("|")}`
                  : ""
              }`}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              title={
                selected.size > 0
                  ? "Open a printable factory work order for the selected products"
                  : "Opens a printable factory work order for all products in production"
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Generate factory work order
              {selected.size > 0 && (
                <span className="rounded-full bg-emerald-200 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-900">
                  {selected.size}
                </span>
              )}
            </Link>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={clear}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Clear product filter
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {options.map((o) => {
              const active = selected.has(o.key);
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => toggle(o.key)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-1"
                      : "border-border bg-white hover:bg-secondary/60"
                  }`}
                >
                  <div className="text-sm font-semibold">{o.title}</div>
                  {o.variant && (
                    <div className="text-xs text-muted-foreground">
                      {o.variant}
                    </div>
                  )}
                  <div className="mt-1 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {o.count} order{o.count === 1 ? "" : "s"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
