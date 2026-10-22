"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { StockRow } from "@/lib/semi-stock";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function SemiStockBoard({
  rows,
  modelSuggestions,
  canEdit,
  canDelete,
}: {
  rows: StockRow[];
  modelSuggestions: string[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const byModel = new Map<string, StockRow[]>();
  for (const r of rows) {
    const arr = byModel.get(r.model) ?? [];
    arr.push(r);
    byModel.set(r.model, arr);
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <AddItemForm
          suggestions={modelSuggestions}
          onDone={() => router.refresh()}
        />
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No stock items yet. Add one above, e.g. <b>Nest · 120 cm · 10</b>.
          </CardContent>
        </Card>
      ) : (
        Array.from(byModel.entries()).map(([model, items]) => (
          <Card key={model}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{model}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((r) => (
                <StockLine
                  key={r.id}
                  row={r}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onDone={() => router.refresh()}
                />
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function AddItemForm({
  suggestions,
  onDone,
}: {
  suggestions: string[];
  onDone: () => void;
}) {
  const [model, setModel] = React.useState("");
  const [size, setSize] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await call("/api/semi-stock", "POST", {
        model,
        sizeCm: Number(size),
        initialQty: Number(qty || 0),
      });
      toast.success(`${model} ${size} added`);
      setSize("");
      setQty("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Bed model
            <Input
              list="semi-stock-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Nest"
              className="w-48"
              required
            />
            <datalist id="semi-stock-models">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Size (cm)
            <Input
              type="number"
              inputMode="numeric"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="120"
              className="w-28"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            In stock now
            <Input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="10"
              className="w-28"
            />
          </label>
          <Button type="submit" disabled={busy}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          The model name must match the Shopify product title (e.g. &ldquo;Tiny
          Cloud&rdquo;). Only orders placed after you add an item take from it.
        </p>
      </CardContent>
    </Card>
  );
}

function StockLine({
  row,
  canEdit,
  canDelete,
  onDone,
}: {
  row: StockRow;
  canEdit: boolean;
  canDelete: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [qty, setQty] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const tone =
    row.onHand < 0
      ? "bg-rose-100 text-rose-800"
      : row.onHand <= row.lowStockAt
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";

  async function adjust(sign: 1 | -1) {
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("Enter a quantity");
      return;
    }
    setBusy(true);
    try {
      await call(`/api/semi-stock/${row.id}`, "POST", {
        delta: sign * n,
        note: note || undefined,
      });
      toast.success(`${sign > 0 ? "+" : "−"}${n} ${row.model} ${row.sizeCm}`);
      setQty("");
      setNote("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${row.model} ${row.sizeCm} and all its history?`)) return;
    try {
      await call(`/api/semi-stock/${row.id}`, "DELETE");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-sm font-semibold"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {row.sizeCm} cm
        </button>
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${tone}`}>
          {row.onHand}
        </span>
        <span className="text-xs text-muted-foreground">
          {row.allocated} taken by orders
          {row.onHand < 0 && " · short — produce more"}
          {row.onHand >= 0 && row.onHand <= row.lowStockAt && " · low stock"}
        </span>

        {canEdit && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              className="h-8 w-20"
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="h-8 w-40"
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => adjust(1)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => adjust(-1)}>
              <Minus className="h-3.5 w-3.5" /> Remove
            </Button>
            {canDelete && (
              <Button size="sm" variant="ghost" onClick={remove} title="Delete item">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="border-t border-border px-3 py-2">
          {row.history.length === 0 ? (
            <div className="text-xs text-muted-foreground">No history yet.</div>
          ) : (
            <ul className="space-y-1 text-xs">
              {row.history.map((h, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    <span className="text-muted-foreground">
                      {new Date(h.at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>{" "}
                    · {h.label}
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${h.delta < 0 ? "text-rose-700" : "text-emerald-700"}`}
                  >
                    {h.delta > 0 ? `+${h.delta}` : h.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
