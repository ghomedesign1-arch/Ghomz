"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { apiPut } from "@/lib/api-client";
import { formatLE } from "@/lib/costing";

export interface YieldProductOption {
  id: string;
  name: string;
  sku: string;
  /** Volume of this product's cut from the parent sponge (cm³). 0 means the
   *  product doesn't have a BOM entry for this block yet. */
  cutVolumePerUnit: number;
}

interface EditYieldsDialogProps {
  spongeId: string;
  spongeName: string;
  blockVolumeCm3: number;
  blockCost: number;
  products: YieldProductOption[];
  initial: { productId: string; unitsPerBlock: number }[];
}

interface Row {
  productId: string;
  unitsPerBlock: number;
}

export function EditYieldsDialog({
  spongeId,
  spongeName,
  blockVolumeCm3,
  blockCost,
  products,
  initial,
}: EditYieldsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>(initial);

  React.useEffect(() => {
    if (open) setRows(initial);
  }, [open, initial]);

  function addRow() {
    const used = new Set(rows.map((r) => r.productId));
    const next = products.find((p) => !used.has(p.id));
    if (!next) return;
    setRows((prev) => [...prev, { productId: next.id, unitsPerBlock: 1 }]);
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  }

  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Compute used volume and per-product share preview.
  const decorated = rows.map((r) => {
    const prod = products.find((p) => p.id === r.productId);
    const vol = (prod?.cutVolumePerUnit ?? 0) * r.unitsPerBlock;
    return { ...r, name: prod?.name ?? "—", volume: vol };
  });
  const totalVolume = decorated.reduce((a, r) => a + r.volume, 0);
  const wasteVolume = Math.max(0, blockVolumeCm3 - totalVolume);
  const overflow = totalVolume > blockVolumeCm3;

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiPut(`/api/sponges/${spongeId}/yields`, {
        yields: rows.map((r) => ({
          productId: r.productId,
          unitsPerBlock: r.unitsPerBlock,
        })),
      });
      toast.success("Cutting plan saved");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Scissors className="h-4 w-4" /> Edit cutting plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cutting plan · {spongeName}</DialogTitle>
          <DialogDescription>
            How many of each product you typically cut from <strong>one block</strong>.
            The block cost is split across these products by volume share.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-3">
            {decorated.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No products in the plan yet. Add one to start.
              </div>
            )}
            {decorated.map((row, i) => {
              const otherUsed = new Set(
                rows.filter((_, idx) => idx !== i).map((r) => r.productId),
              );
              const pickable = products.filter(
                (p) => p.id === row.productId || !otherUsed.has(p.id),
              );
              const share =
                totalVolume > 0 ? (row.volume / totalVolume) * 100 : 0;
              const perUnit =
                row.unitsPerBlock > 0 && totalVolume > 0
                  ? (row.volume / totalVolume) * blockCost / row.unitsPerBlock
                  : 0;
              const missingCut =
                products.find((p) => p.id === row.productId)
                  ?.cutVolumePerUnit === 0;
              return (
                <div
                  key={i}
                  className="grid grid-cols-1 items-start gap-3 rounded-xl border bg-secondary/30 p-4 sm:grid-cols-[1fr_120px_120px_120px_auto]"
                >
                  <Field
                    label="Product"
                    error={
                      missingCut
                        ? `${row.name} has no BOM entry for this block — add the cut in Edit BOM first`
                        : undefined
                    }
                  >
                    <Select
                      value={row.productId}
                      onValueChange={(v) => update(i, { productId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pickable.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({p.sku})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Units / block">
                    <Input
                      type="number"
                      min={1}
                      value={row.unitsPerBlock}
                      onChange={(e) =>
                        update(i, { unitsPerBlock: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Share %">
                    <div className="flex h-10 items-center justify-end rounded-lg bg-card px-3 text-sm tabular-nums">
                      {share.toFixed(1)}%
                    </div>
                  </Field>
                  <Field label="Cost / unit">
                    <div className="flex h-10 items-center justify-end rounded-lg bg-card px-3 text-sm font-medium tabular-nums">
                      {formatLE(perUnit)}
                    </div>
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(i)}
                    aria-label="Remove product from plan"
                    className="mt-5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={rows.length >= products.length}
          >
            <Plus className="h-4 w-4" /> Add product
          </Button>

          <div
            className={`grid grid-cols-2 gap-3 rounded-xl border p-4 text-sm sm:grid-cols-4 ${
              overflow ? "border-destructive bg-destructive/5" : "bg-secondary/30"
            }`}
          >
            <Stat
              label="Used volume"
              value={`${(totalVolume / 1_000_000).toFixed(3)} m³`}
            />
            <Stat
              label="Block volume"
              value={`${(blockVolumeCm3 / 1_000_000).toFixed(3)} m³`}
            />
            <Stat
              label={overflow ? "Overflow" : "Waste"}
              value={`${((overflow ? -wasteVolume : wasteVolume) /
                1_000_000).toFixed(3)} m³`}
              tone={overflow ? "destructive" : undefined}
            />
            <Stat
              label="Block cost"
              value={formatLE(blockCost)}
            />
          </div>

          {overflow && (
            <p className="text-xs text-destructive">
              The cuts add up to more than one block can hold. Lower the unit
              counts or revisit the cut dimensions on the BOMs.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || overflow}>
              {submitting ? "Saving…" : "Save cutting plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "destructive";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`tabular-nums font-medium ${
          tone === "destructive" ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
