"use client";

import * as React from "react";
import { CheckCheck, ChevronDown, ChevronUp } from "lucide-react";

const STORAGE_KEY = "shopify-orders.shipped-visible";

/**
 * Collapsible wrapper for the shipped-orders section at the bottom of the
 * list. Preference persists in localStorage so the toggle sticks on reload.
 */
export function ShippedSection({
  count,
  children,
  defaultOpen = false,
}: {
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [visible, setVisible] = React.useState(defaultOpen);
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setVisible(true);
      else if (v === "0") setVisible(false);
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

  return (
    <div className="space-y-3 pt-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={visible}
        className="flex w-full items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium hover:bg-emerald-100"
      >
        <span className="inline-flex items-center gap-2">
          <CheckCheck className="h-4 w-4 text-emerald-700" />
          Shipped orders
          <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
            {count}
          </span>
          {!visible && (
            <span className="text-xs font-normal text-emerald-800">
              — hidden
            </span>
          )}
        </span>
        {visible ? (
          <ChevronUp className="h-4 w-4 text-emerald-800" />
        ) : (
          <ChevronDown className="h-4 w-4 text-emerald-800" />
        )}
      </button>

      {visible && <div className="space-y-3">{children}</div>}
    </div>
  );
}
