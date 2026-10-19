"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewProduct {
  id: string;
  sku: string;
  name: string;
  variantName: string | null;
  widthCm: number;
  depthCm: number;
}
interface PreviewVariant extends PreviewProduct {
  suggestedVariantName: string;
}
interface Group {
  parent: PreviewProduct;
  variants: PreviewVariant[];
}

export function DedupePreview() {
  const [groups, setGroups] = React.useState<Group[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [accepted, setAccepted] = React.useState<Set<string>>(new Set());
  const [applying, setApplying] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products/dedupe");
      if (!res.ok) {
        toast.error("Failed to load preview");
        return;
      }
      const data = (await res.json()) as { groups: Group[] };
      setGroups(data.groups);
      setAccepted(new Set(data.groups.map((g) => g.parent.id)));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply() {
    if (accepted.size === 0) {
      toast.error("Pick at least one group");
      return;
    }
    if (!confirm(`Collapse ${accepted.size} product group${accepted.size === 1 ? "" : "s"} into variants?`)) {
      return;
    }
    setApplying(true);
    try {
      const res = await fetch("/api/products/dedupe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedParents: Array.from(accepted) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Apply failed");
        return;
      }
      toast.success(`Collapsed ${payload.groupsChanged} group${payload.groupsChanged === 1 ? "" : "s"}`);
      load();
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading preview…
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        No duplicate top-level products found — nothing to collapse.
      </div>
    );
  }

  const totalVariants = groups.reduce((a, g) => a + g.variants.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 p-3 text-sm">
        <div>
          <span className="font-semibold">{groups.length}</span>{" "}
          duplicate group{groups.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold">{totalVariants}</span>{" "}
          product{totalVariants === 1 ? "" : "s"} will become variants
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setAccepted(new Set(groups.map((g) => g.parent.id)))
            }
            className="text-xs text-muted-foreground hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setAccepted(new Set())}
            className="text-xs text-muted-foreground hover:underline"
          >
            Clear
          </button>
          <Button
            type="button"
            onClick={apply}
            disabled={applying || accepted.size === 0}
          >
            {applying ? "Applying…" : `Apply (${accepted.size})`}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {groups.map((g) => {
          const checked = accepted.has(g.parent.id);
          return (
            <div
              key={g.parent.id}
              className={`rounded-xl border p-4 ${
                checked
                  ? "border-primary bg-primary/5"
                  : "border-border bg-white"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(g.parent.id)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {g.parent.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      — {g.variants.length} variant
                      {g.variants.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Parent SKU: {g.parent.sku} · W{Math.round(g.parent.widthCm)} × D
                    {Math.round(g.parent.depthCm)}
                  </div>

                  <ul className="mt-3 space-y-1 text-sm">
                    {g.variants.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-1.5"
                      >
                        <span>
                          <span className="text-muted-foreground">
                            {v.sku}
                          </span>{" "}
                          → <span className="font-medium">{v.suggestedVariantName}</span>
                        </span>
                        {v.variantName && (
                          <span className="text-[10px] text-muted-foreground">
                            was: {v.variantName}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                {checked && (
                  <Check className="h-5 w-5 shrink-0 text-primary" />
                )}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
