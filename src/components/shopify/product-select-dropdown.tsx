"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";

export interface ProductSelectOption {
  name: string;
  orderCount: number;
}

/**
 * Multi-select dropdown of product names used in the orders search bar.
 * Selection is encoded in the URL as ?product=A|B|C so it survives reloads
 * and composes with the other filters. A single-select native <select>
 * couldn't do multi on mobile, so this is a custom popover with checkboxes.
 */
export function ProductSelectDropdown({
  options,
  activeNames,
}: {
  options: ProductSelectOption[];
  activeNames: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const popRef = React.useRef<HTMLDivElement>(null);
  // Local draft so toggling a checkbox doesn't fire a navigation per click.
  const [draft, setDraft] = React.useState<Set<string>>(
    () => new Set(activeNames),
  );

  React.useEffect(() => {
    setDraft(new Set(activeNames));
  }, [activeNames.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        commit();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  function toggle(name: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function commit() {
    setOpen(false);
    const q = new URLSearchParams(params.toString());
    if (draft.size === 0) q.delete("product");
    else q.set("product", Array.from(draft).join("|"));
    router.push(`/shopify-orders?${q.toString()}`);
  }

  function clearAll() {
    setDraft(new Set());
  }

  const label =
    draft.size === 0
      ? "All products"
      : draft.size === 1
        ? Array.from(draft)[0]
        : `${Array.from(draft)[0]} + ${draft.size - 1} more`;

  return (
    <div ref={popRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex h-9 min-w-[160px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-secondary/50"
      >
        <span className="truncate">
          {label}
          {draft.size > 1 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {draft.size}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-80 w-72 overflow-auto rounded-md border border-border bg-white p-1 shadow-md">
          <button
            type="button"
            onClick={clearAll}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary"
          >
            <span>All products</span>
            {draft.size === 0 && (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            )}
          </button>
          <div className="my-1 border-t border-border" />
          {options.map((o) => {
            const checked = draft.has(o.name);
            return (
              <button
                key={o.name}
                type="button"
                onClick={() => toggle(o.name)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary ${
                  checked ? "bg-emerald-50" : ""
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-input bg-background"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span>{o.name}</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {o.orderCount}
                </span>
              </button>
            );
          })}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={commit}
            className="flex w-full items-center justify-center rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
