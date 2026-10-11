"use client";

import * as React from "react";
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

type Variant = "shipped" | "ready";

const VARIANTS: Record<
  Variant,
  { label: string; icon: LucideIcon; container: string; chip: string; chevron: string }
> = {
  shipped: {
    label: "Shipped orders",
    icon: CheckCheck,
    container: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100",
    chip: "bg-emerald-200 text-emerald-900",
    chevron: "text-emerald-800",
  },
  ready: {
    label: "Ready orders",
    icon: PackageCheck,
    container: "border-sky-200 bg-sky-50 hover:bg-sky-100",
    chip: "bg-sky-200 text-sky-900",
    chevron: "text-sky-800",
  },
};

/**
 * Collapsible wrapper for a bucket of orders (shipped or ready). The toggle
 * preference persists in localStorage per variant.
 */
export function OrdersSection({
  variant,
  count,
  children,
  defaultOpen = false,
}: {
  variant: Variant;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const storageKey = `shopify-orders.${variant}-visible`;
  const [visible, setVisible] = React.useState(defaultOpen);
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1") setVisible(true);
      else if (v === "0") setVisible(false);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggle = () => {
    setVisible((v) => {
      const next = !v;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const cfg = VARIANTS[variant];
  const Icon = cfg.icon;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={visible}
        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium ${cfg.container}`}
      >
        <span className="inline-flex items-center gap-2">
          <Icon className={`h-4 w-4 ${cfg.chevron}`} />
          {cfg.label}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.chip}`}
          >
            {count}
          </span>
          {!visible && (
            <span className={`text-xs font-normal ${cfg.chevron}`}>
              — hidden
            </span>
          )}
        </span>
        {visible ? (
          <ChevronUp className={`h-4 w-4 ${cfg.chevron}`} />
        ) : (
          <ChevronDown className={`h-4 w-4 ${cfg.chevron}`} />
        )}
      </button>

      {visible && <div className="space-y-3">{children}</div>}
    </div>
  );
}

// Keep the old name as a thin wrapper so existing imports continue to work.
export function ShippedSection(
  props: Omit<React.ComponentProps<typeof OrdersSection>, "variant">,
) {
  return <OrdersSection variant="shipped" {...props} />;
}
