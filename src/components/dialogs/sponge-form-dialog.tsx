"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGrid } from "@/components/forms/field";
import { Separator } from "@/components/ui/separator";
import { apiPatch, apiPost } from "@/lib/api-client";
import { spongeBlockCost, formatLE } from "@/lib/costing";

const HARDNESS = [
  { value: "SUPER_SOFT", label: "Super soft" },
  { value: "SOFT", label: "Soft" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
];

export interface SpongeFormValues {
  id?: string;
  name: string;
  color: string;
  hardness: string;
  density: number;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  pricePerDensity: number;
  stockBlocks: number;
  wastePct: number;
  supplierId: string;
  /** YYYY-MM-DD format — what the native date input emits. Empty string = unset. */
  manufactureDate: string;
  notes: string;
}

export interface YieldRow {
  productId: string;
  unitsPerBlock: number;
  /** Cut dimensions of one piece of this product from this block (cm³). Used
   *  to compute the live volume share % preview. Default 0 if the product has
   *  no BOM row for this sponge yet. */
  cutVolumePerUnit: number;
}

export interface ProductForYield {
  id: string;
  name: string;
  sku: string;
  /** Cut volume per unit from this sponge block. Computed server-side. */
  cutVolumePerUnit: number;
}

const DEFAULTS: SpongeFormValues = {
  name: "",
  color: "",
  hardness: "SOFT",
  density: 26,
  widthCm: 240,
  depthCm: 200,
  heightCm: 120,
  pricePerDensity: 220,
  stockBlocks: 0,
  wastePct: 5,
  supplierId: "",
  manufactureDate: "",
  notes: "",
};

interface SpongeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: { id: string; name: string }[];
  initial?: SpongeFormValues;
  /** Products that can be assigned to this block's cutting plan. Provide []
   *  to hide the cutting-plan section entirely (e.g. on the new-sponge
   *  workflow before any products exist). */
  products?: ProductForYield[];
  /** Existing cutting plan when editing. */
  initialYields?: YieldRow[];
}

export function SpongeFormDialog({
  open,
  onOpenChange,
  suppliers,
  initial,
  products = [],
  initialYields = [],
}: SpongeFormDialogProps) {
  const router = useRouter();
  const [form, setForm] = React.useState<SpongeFormValues>(
    initial ?? DEFAULTS,
  );
  const [yields, setYields] = React.useState<YieldRow[]>(initialYields);
  const [submitting, setSubmitting] = React.useState(false);
  const isEdit = !!initial?.id;

  // Reset form whenever the dialog reopens. We only depend on `open` so the
  // default `initialYields = []` / `initial = undefined` references — which
  // are fresh on every parent render — don't trigger a render loop.
  React.useEffect(() => {
    if (open) {
      setForm(initial ?? DEFAULTS);
      setYields(initialYields);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const liveCost = spongeBlockCost({
    widthCm: form.widthCm,
    depthCm: form.depthCm,
    heightCm: form.heightCm,
    density: form.density,
    pricePerDensity: form.pricePerDensity,
  });

  function set<K extends keyof SpongeFormValues>(
    key: K,
    value: SpongeFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        color: form.color,
        hardness: form.hardness,
        density: form.density,
        widthCm: form.widthCm,
        depthCm: form.depthCm,
        heightCm: form.heightCm,
        pricePerDensity: form.pricePerDensity,
        stockBlocks: form.stockBlocks,
        wastePct: form.wastePct,
        supplierId: form.supplierId || undefined,
        // Native date input gives YYYY-MM-DD — convert to ISO datetime for Zod.
        manufactureDate: form.manufactureDate
          ? new Date(form.manufactureDate).toISOString()
          : null,
        notes: form.notes || undefined,
        // Always send the yields array so PATCH replaces it with what the
        // user sees on screen. Empty array clears any existing plan.
        yields: yields
          .filter((y) => y.productId && y.unitsPerBlock > 0)
          .map((y) => ({
            productId: y.productId,
            unitsPerBlock: y.unitsPerBlock,
          })),
      };
      if (isEdit && initial?.id) {
        await apiPatch(`/api/sponges/${initial.id}`, payload);
        toast.success(`Updated "${form.name}"`);
      } else {
        await apiPost("/api/sponges", payload);
        toast.success(`Added sponge "${form.name}"`);
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${initial?.name ?? "sponge"}` : "New sponge block"}
          </DialogTitle>
          <DialogDescription>
            Unit cost is auto-computed from W × D × H × density × price multiplier.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGrid cols={2}>
            <Field label="Name">
              <Input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Yellow 26 Soft"
              />
            </Field>
            <Field label="Color">
              <Input
                required
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                placeholder="Yellow"
              />
            </Field>
          </FieldGrid>

          <FieldGrid cols={3}>
            <Field label="Hardness">
              <Select
                value={form.hardness}
                onValueChange={(v) => set("hardness", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HARDNESS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Density (kg/m³)">
              <Input
                type="number"
                min={1}
                required
                value={form.density}
                onChange={(e) => set("density", Number(e.target.value))}
              />
            </Field>
            <Field label="Price multiplier (LE)">
              <Input
                type="number"
                step="0.01"
                min={0}
                required
                value={form.pricePerDensity}
                onChange={(e) =>
                  set("pricePerDensity", Number(e.target.value))
                }
              />
            </Field>
          </FieldGrid>

          <FieldGrid cols={3}>
            <Field label="Width (cm)">
              <Input
                type="number"
                min={1}
                step="0.1"
                required
                value={form.widthCm}
                onChange={(e) => set("widthCm", Number(e.target.value))}
              />
            </Field>
            <Field label="Depth (cm)">
              <Input
                type="number"
                min={1}
                step="0.1"
                required
                value={form.depthCm}
                onChange={(e) => set("depthCm", Number(e.target.value))}
              />
            </Field>
            <Field label="Height (cm)">
              <Input
                type="number"
                min={1}
                step="0.1"
                required
                value={form.heightCm}
                onChange={(e) => set("heightCm", Number(e.target.value))}
              />
            </Field>
          </FieldGrid>

          <FieldGrid cols={3}>
            <Field label="Stock blocks">
              <Input
                type="number"
                min={0}
                value={form.stockBlocks}
                onChange={(e) => set("stockBlocks", Number(e.target.value))}
              />
            </Field>
            <Field label="Waste %">
              <Input
                type="number"
                min={0}
                max={50}
                step="0.1"
                value={form.wastePct}
                onChange={(e) => set("wastePct", Number(e.target.value))}
              />
            </Field>
            <Field label="Supplier">
              <Select
                value={form.supplierId || "__none__"}
                onValueChange={(v) =>
                  set("supplierId", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGrid>

          <FieldGrid cols={2}>
            <Field
              label="Manufacture date"
              hint="When the supplier produced this batch. Optional."
            >
              <Input
                type="date"
                value={form.manufactureDate}
                onChange={(e) => set("manufactureDate", e.target.value)}
              />
            </Field>
            <Field label="Notes">
              <Input
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </FieldGrid>

          <div className="rounded-xl bg-secondary/60 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Computed unit cost</span>
              <span className="font-display text-lg font-semibold tabular-nums">
                {formatLE(liveCost)}
              </span>
            </div>
          </div>

          {products.length > 0 && (
            <>
              <Separator />
              <YieldsSection
                yields={yields}
                products={products}
                blockVolumeCm3={
                  form.widthCm * form.depthCm * form.heightCm
                }
                blockCost={liveCost}
                onChange={setYields}
              />
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Add sponge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Cutting-plan section ────────────────────────────────────────────────────

function YieldsSection({
  yields,
  products,
  blockVolumeCm3,
  blockCost,
  onChange,
}: {
  yields: YieldRow[];
  products: ProductForYield[];
  blockVolumeCm3: number;
  blockCost: number;
  onChange: (next: YieldRow[]) => void;
}) {
  const productMap = new Map(products.map((p) => [p.id, p]));

  function addRow() {
    const used = new Set(yields.map((y) => y.productId));
    const next = products.find((p) => !used.has(p.id));
    if (!next) return;
    onChange([
      ...yields,
      {
        productId: next.id,
        unitsPerBlock: 1,
        cutVolumePerUnit: next.cutVolumePerUnit,
      },
    ]);
  }

  function updateRow(i: number, patch: Partial<YieldRow>) {
    onChange(
      yields.map((y, idx) => {
        if (idx !== i) return y;
        const next = { ...y, ...patch };
        // Refresh cutVolumePerUnit when the product changes.
        if (patch.productId) {
          next.cutVolumePerUnit =
            productMap.get(patch.productId)?.cutVolumePerUnit ?? 0;
        }
        return next;
      }),
    );
  }

  function removeRow(i: number) {
    onChange(yields.filter((_, idx) => idx !== i));
  }

  const totalUsed = yields.reduce(
    (acc, y) => acc + y.cutVolumePerUnit * y.unitsPerBlock,
    0,
  );
  const overflow = totalUsed > blockVolumeCm3;
  const waste = Math.max(0, blockVolumeCm3 - totalUsed);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Products from this block</div>
          <div className="text-xs text-muted-foreground">
            How many of each product you cut from <strong>one block</strong>.
            The block cost is split across these products by volume share.
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRow}
          disabled={yields.length >= products.length}
        >
          <Plus className="h-4 w-4" /> Add product
        </Button>
      </div>

      {yields.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No products in the plan. Each product&apos;s sponge cost will fall
          back to per-product allocation with the block&apos;s waste %.
        </div>
      )}

      {yields.map((row, i) => {
        const usedIds = new Set(
          yields.filter((_, idx) => idx !== i).map((y) => y.productId),
        );
        const pickable = products.filter(
          (p) => p.id === row.productId || !usedIds.has(p.id),
        );
        const usedVol = row.cutVolumePerUnit * row.unitsPerBlock;
        const share = totalUsed > 0 ? (usedVol / totalUsed) * 100 : 0;
        const perUnit =
          row.unitsPerBlock > 0 && totalUsed > 0
            ? (usedVol / totalUsed) * blockCost / row.unitsPerBlock
            : 0;
        const missingCut =
          productMap.get(row.productId)?.cutVolumePerUnit === 0;
        return (
          <div
            key={i}
            className="grid grid-cols-1 items-start gap-3 rounded-xl border bg-secondary/30 p-4 sm:grid-cols-[1fr_120px_120px_120px_auto]"
          >
            <Field
              label="Product"
              error={
                missingCut
                  ? "Add a sponge BOM line to this product first so we know the cut volume"
                  : undefined
              }
            >
              <Select
                value={row.productId}
                onValueChange={(v) => updateRow(i, { productId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a product…" />
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
                  updateRow(i, { unitsPerBlock: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Share">
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
              onClick={() => removeRow(i)}
              aria-label="Remove product"
              className="mt-5"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      {yields.length > 0 && (
        <div
          className={
            overflow
              ? "rounded-xl border border-destructive bg-destructive/5 p-3 text-xs"
              : "rounded-xl border bg-secondary/30 p-3 text-xs"
          }
        >
          <div className="grid grid-cols-4 gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Used
              </div>
              <div className="tabular-nums font-medium">
                {(totalUsed / 1_000_000).toFixed(3)} m³
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Block volume
              </div>
              <div className="tabular-nums font-medium">
                {(blockVolumeCm3 / 1_000_000).toFixed(3)} m³
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {overflow ? "Overflow" : "Leftover"}
              </div>
              <div
                className={`tabular-nums font-medium ${
                  overflow ? "text-destructive" : ""
                }`}
              >
                {((overflow ? totalUsed - blockVolumeCm3 : waste) /
                  1_000_000).toFixed(3)}{" "}
                m³
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Block cost
              </div>
              <div className="tabular-nums font-medium">
                {formatLE(blockCost)}
              </div>
            </div>
          </div>
          {overflow && (
            <p className="mt-2 text-destructive">
              The cuts add up to more than one block. Lower the unit counts —
              or save anyway if your real-world yield really is that creative.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
