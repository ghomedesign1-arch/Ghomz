"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageCircle,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ProductNameOption {
  /** Product title (used as the key too) */
  name: string;
  /** How many deposit/paid orders currently include this product */
  orderCount: number;
}

export interface ProductSizeBreakdownRow {
  product: string;
  /** [{ width, color, qty }, …] sorted by width asc then color alpha */
  sizes: { width: string; color: string | null; qty: number }[];
  totalUnits: number;
}

const STORAGE_KEY = "shopify-orders.work-order-visible";

/**
 * Product-name filter + factory work-order summary. Tiles are at product
 * level only; selecting one or more products renders a per-product size
 * breakdown (W120 × 3, W140 × 5 …) counting only line items from orders
 * where the customer has already paid a deposit (or the full amount).
 */
export function FactoryWorkOrder({
  options,
  breakdown,
}: {
  options: ProductNameOption[];
  breakdown: ProductSizeBreakdownRow[];
}) {
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
    const raw = params.get("factoryProducts") ?? "";
    return new Set(raw ? raw.split("|").filter(Boolean) : []);
  }, [params]);

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    const q = new URLSearchParams(params.toString());
    if (next.size === 0) q.delete("factoryProducts");
    else q.set("factoryProducts", Array.from(next).join("|"));
    router.push(`/shopify-orders?${q.toString()}`);
  }

  function clear() {
    const q = new URLSearchParams(params.toString());
    q.delete("factoryProducts");
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

  const totalUnits = breakdown.reduce((a, r) => a + r.totalUnits, 0);

  const workOrderText = React.useMemo(() => {
    if (breakdown.length === 0) return "";
    const today = new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const lines = [
      "G-Homz Factory Work Order",
      `Date: ${today}`,
      "",
      "Please produce:",
    ];
    for (const row of breakdown) {
      lines.push(`${row.product}`);
      for (const s of row.sizes) {
        const label = s.color ? `W${s.width} · ${s.color}` : `W${s.width}`;
        lines.push(`  • ${label} × ${s.qty}`);
      }
      lines.push(`  (total ${row.totalUnits})`);
    }
    lines.push("");
    lines.push(`Total units: ${totalUnits}`);
    lines.push("(Only orders with a deposit paid are counted)");
    return lines.join("\n");
  }, [breakdown, totalUnits]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(workOrderText);
      toast.success("Work order copied — paste into WhatsApp / email");
    } catch {
      toast.error("Clipboard access blocked");
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
          <div className="text-sm font-medium">Work order ready</div>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
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
            className="inline-block rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Tap to open WhatsApp
          </a>
        </div>,
        { duration: 30_000 },
      );
    }
  }

  function print() {
    if (breakdown.length === 0) return;
    const today = new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const esc = (s: string) =>
      s.replace(/[&<>"]/g, (c) =>
        c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
      );
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>G-Homz · Factory Work Order / أمر تشغيل للمصنع</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  body { font-family: "Cairo", -apple-system, system-ui, "Segoe UI", sans-serif; padding: 32px; color: #111; }
  h1 { font-size: 22px; margin: 0; }
  h1 .ar { display: block; font-size: 18px; color: #333; font-weight: 600; margin-top: 2px; direction: rtl; text-align: left; }
  .date { color: #666; font-size: 13px; margin: 4px 0 4px; }
  .date .ar { display: block; direction: rtl; }
  .meta { font-size: 13px; color: #333; margin: 10px 0 20px; }
  .meta .ar { display: block; direction: rtl; color: #555; }
  .product { padding: 12px 0; border-top: 1px solid #e5e5e5; }
  .product:first-of-type { border-top: 2px solid #111; }
  .name { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
  .name small { color: #666; font-weight: 400; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border: 1px solid #bbb; border-radius: 6px; padding: 6px 10px; font-size: 14px; }
  .chip strong { font-weight: 600; margin-left: 4px; }
  .total { margin-top: 20px; padding-top: 12px; border-top: 2px solid #111; font-size: 15px; font-weight: 600; }
  .total .ar { display: block; direction: rtl; font-size: 14px; color: #333; margin-top: 2px; }
  @media print {
    body { padding: 20mm; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<h1>
  G-Homz · Factory Work Order
  <span class="ar">جي-هومز · أمر تشغيل للمصنع</span>
</h1>
<div class="date">
  Date: ${esc(today)}
  <span class="ar">التاريخ: ${esc(today)}</span>
</div>
<div class="meta">
  ${breakdown.length} product${breakdown.length === 1 ? "" : "s"} · ${totalUnits} unit${totalUnits === 1 ? "" : "s"} · deposit-paid orders only
  <span class="ar">${breakdown.length} ${breakdown.length === 1 ? "منتج" : "منتجات"} · ${totalUnits} ${totalUnits === 1 ? "وحدة" : "وحدة"} · طلبات دفعت العربون فقط</span>
</div>
${breakdown
  .map(
    (row) => `
<div class="product">
  <div class="name">${esc(row.product)} <small>— total / الإجمالي ${row.totalUnits}</small></div>
  <div class="chips">
    ${row.sizes
      .map(
        (s) =>
          `<span class="chip">W${esc(s.width)}${s.color ? " · " + esc(s.color) : ""} × <strong>${s.qty}</strong></span>`,
      )
      .join("")}
  </div>
</div>`,
  )
  .join("")}
<div class="total">
  Total units to produce: ${totalUnits}
  <span class="ar">إجمالي الوحدات للتصنيع: ${totalUnits}</span>
</div>
<script>window.addEventListener("load",()=>{setTimeout(()=>window.print(),400);});window.onafterprint=()=>window.close();</script>
</body>
</html>`;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      toast.error("Popup blocked — allow popups to print");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
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
          Factory work order
          {selected.size > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {selected.size} selected · {totalUnits} unit
              {totalUnits === 1 ? "" : "s"}
            </span>
          )}
          <span className="text-xs font-normal text-muted-foreground">
            Pick products → see what to make
          </span>
        </span>
        {visible ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {visible && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {options.map((o) => {
              const active = selected.has(o.name);
              return (
                <button
                  key={o.name}
                  type="button"
                  onClick={() => toggle(o.name)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-1"
                      : "border-border bg-white hover:bg-secondary/60"
                  }`}
                >
                  <div className="text-sm font-semibold">{o.name}</div>
                  <div className="mt-1 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {o.orderCount} order{o.orderCount === 1 ? "" : "s"}
                  </div>
                </button>
              );
            })}
          </div>

          {selected.size > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="text-sm font-semibold text-emerald-900">
                  Factory sheet · {totalUnits} unit
                  {totalUnits === 1 ? "" : "s"}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copy}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={whatsApp}
                    className="border-emerald-400 text-emerald-700 hover:bg-emerald-100"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </Button>
                  <Button type="button" size="sm" onClick={print}>
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Button>
                  <button
                    type="button"
                    onClick={clear}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {breakdown.length === 0 ? (
                <div className="p-5 text-center text-sm text-muted-foreground">
                  No deposit-paid orders for the selected products yet.
                </div>
              ) : (
                <div className="divide-y divide-emerald-200">
                  {breakdown.map((row) => (
                    <div key={row.product} className="px-3 py-3">
                      <div className="mb-1 text-sm font-semibold">
                        {row.product}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          — total {row.totalUnits}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {row.sizes.map((s, i) => (
                          <span
                            key={`${s.width}|${s.color ?? ""}|${i}`}
                            className="inline-flex items-baseline gap-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-sm"
                          >
                            <span className="font-medium">W{s.width}</span>
                            {s.color && (
                              <span className="text-muted-foreground">
                                · {s.color}
                              </span>
                            )}
                            <span className="text-muted-foreground">×</span>
                            <span className="font-display text-lg font-semibold">
                              {s.qty}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
