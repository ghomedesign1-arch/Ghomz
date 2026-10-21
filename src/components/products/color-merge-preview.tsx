"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewVariant {
  id: string;
  sku: string;
  variantName: string | null;
  retailPrice: number;
}
interface Group {
  parentId: string;
  parentName: string;
  nonColorKey: string;
  canonical: PreviewVariant;
  duplicates: PreviewVariant[];
}
interface Diagnostics {
  parentsScanned: number;
  activeVariantsScanned: number;
}

export function ColorMergePreview() {
  const [groups, setGroups] = React.useState<Group[] | null>(null);
  const [diagnostics, setDiagnostics] = React.useState<Diagnostics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [accepted, setAccepted] = React.useState<Set<string>>(new Set());
  const [applying, setApplying] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products/color-merge");
      if (!res.ok) {
        toast.error("Failed to load preview");
        return;
      }
      const data = (await res.json()) as {
        groups: Group[];
        diagnostics?: Diagnostics;
      };
      setGroups(data.groups);
      setDiagnostics(data.diagnostics ?? null);
      setAccepted(new Set(data.groups.map((g) => g.canonical.id)));
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
    if (!confirm(`Merge ${accepted.size} colour group${accepted.size === 1 ? "" : "s"}? Extras become deactivated aliases.`)) {
      return;
    }
    setApplying(true);
    try {
      const res = await fetch("/api/products/color-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedCanonicalIds: Array.from(accepted) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Merge failed");
        return;
      }
      toast.success(`Merged ${payload.groupsApplied} group${payload.groupsApplied === 1 ? "" : "s"}`);
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
      <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <div>No colour-only variant groups found — nothing to merge.</div>
        {diagnostics && (
          <div className="text-xs text-emerald-800">
            Scanned {diagnostics.parentsScanned} parent product
            {diagnostics.parentsScanned === 1 ? "" : "s"} and{" "}
            {diagnostics.activeVariantsScanned} active variant
            {diagnostics.activeVariantsScanned === 1 ? "" : "s"}. If you&apos;re
            sure duplicates exist, double-check that the variants&apos; SKU
            colour code is in the known list (
            <code>src/lib/variant-detect.ts</code> → SKU_COLOR_CODES).
          </div>
        )}
      </div>
    );
  }

  const totalExtras = groups.reduce((a, g) => a + g.duplicates.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 p-3 text-sm">
        <div>
          <span className="font-semibold">{groups.length}</span>{" "}
          group{groups.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold">{totalExtras}</span>{" "}
          variant{totalExtras === 1 ? "" : "s"} will be deactivated
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setAccepted(new Set(groups.map((g) => g.canonical.id)))
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
          const checked = accepted.has(g.canonical.id);
          return (
            <div
              key={g.canonical.id}
              className={`rounded-xl border p-4 ${checked ? "border-primary bg-primary/5" : "border-border bg-white"}`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(g.canonical.id)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {g.parentName}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      — {g.nonColorKey || "(no variant)"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Canonical: <span className="font-medium">{g.canonical.sku}</span>
                    {g.canonical.variantName && (
                      <> · was &ldquo;{g.canonical.variantName}&rdquo;</>
                    )}
                  </div>

                  <ul className="mt-3 space-y-1 text-sm">
                    {g.duplicates.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-1.5"
                      >
                        <span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {d.sku}
                          </span>{" "}
                          — <span>{d.variantName ?? "—"}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          will deactivate + alias
                        </span>
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
