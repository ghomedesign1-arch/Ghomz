"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGrid } from "@/components/forms/field";
import {
  cutVolumeCm3,
  formatLE,
  spongeBlockCost,
  spongeBlockVolumeCm3,
  unitsPerBlock,
} from "@/lib/costing";
import type { EditableProduct, SpongeRef } from "../types";

interface Props {
  product: EditableProduct;
  sponges: SpongeRef[];
  onChange: (sponges: EditableProduct["sponges"]) => void;
}

export function SpongeSection({ product, sponges, onChange }: Props) {
  const spongeMap = new Map(sponges.map((s) => [s.id, s]));

  function addRow() {
    if (sponges.length === 0) return;
    const first = sponges[0];
    onChange([
      ...product.sponges,
      {
        spongeId: first.id,
        // Cut dimensions are set on the sponge's cutting plan (sponge form);
        // we keep these at 0 here so the cost engine falls back to the
        // cutting-plan's units-only weighting.
        cutWidthCm: 0,
        cutDepthCm: 0,
        cutHeightCm: 0,
        cuts: 1,
        unitsPerBlockOverride: null,
        notes: "",
      },
    ]);
  }

  function updateRow(
    index: number,
    patch: Partial<EditableProduct["sponges"][number]>,
  ) {
    const next = product.sponges.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    );
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(product.sponges.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Sponge blocks used</CardTitle>
          <CardDescription>
            Pick the sponge block(s) this product is cut from. Set how many
            units come from each block — or leave blank and use the cutting
            plan on the sponge page.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRow}
          disabled={sponges.length === 0}
        >
          <Plus className="h-4 w-4" /> Add cut
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {product.sponges.length === 0 && (
          <EmptyState>
            No sponge cuts yet. The product&apos;s sponge cost will be zero
            until you add at least one cut.
          </EmptyState>
        )}
        {product.sponges.map((row, i) => {
          const block = spongeMap.get(row.spongeId);
          const cutVol = cutVolumeCm3(row);
          const blockVol = block ? spongeBlockVolumeCm3(block) : 0;
          const autoUnits = block
            ? unitsPerBlock({ block, cuts: [row] })
            : 0;
          const blockCost = block ? spongeBlockCost(block) : 0;
          const hasOverride =
            row.unitsPerBlockOverride !== null &&
            row.unitsPerBlockOverride !== undefined &&
            row.unitsPerBlockOverride > 0;
          const effectiveUnits = hasOverride
            ? (row.unitsPerBlockOverride as number)
            : autoUnits;
          const rowCost = !block
            ? 0
            : hasOverride
              ? blockCost / (row.unitsPerBlockOverride as number)
              : blockVol > 0
                ? (cutVol / blockVol) *
                  blockCost *
                  (1 / (1 - (block.wastePct ?? 0) / 100))
                : 0;
          return (
            <div
              key={i}
              className="rounded-xl border bg-secondary/30 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <Field label="Sponge block">
                    <Select
                      value={row.spongeId}
                      onValueChange={(v) => updateRow(i, { spongeId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sponges.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}{" "}
                            <span className="text-muted-foreground text-xs">
                              · {s.density}kg/m³ · {s.widthCm}×{s.depthCm}×
                              {s.heightCm}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(i)}
                  aria-label="Remove cut"
                  className="mt-5"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Cut dimensions */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Cut dimensions (cm)
                </p>
                <FieldGrid cols={3}>
                  <Field label="Width">
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder="0"
                      value={row.cutWidthCm || ""}
                      onChange={(e) =>
                        updateRow(i, { cutWidthCm: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Depth">
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder="0"
                      value={row.cutDepthCm || ""}
                      onChange={(e) =>
                        updateRow(i, { cutDepthCm: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Height">
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder="0"
                      value={row.cutHeightCm || ""}
                      onChange={(e) =>
                        updateRow(i, { cutHeightCm: Number(e.target.value) })
                      }
                    />
                  </Field>
                </FieldGrid>
              </div>

              <FieldGrid cols={3}>
                <Field label="Cuts per unit">
                  <Input
                    type="number"
                    min={1}
                    value={row.cuts}
                    onChange={(e) =>
                      updateRow(i, { cuts: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field
                  label="Units / block (override)"
                  hint={
                    hasOverride
                      ? `Auto would be ${autoUnits}`
                      : autoUnits > 0
                        ? `Auto-computed: ${autoUnits}`
                        : "Enter cut dims to auto-compute"
                  }
                >
                  <Input
                    type="number"
                    min={1}
                    placeholder="auto"
                    value={row.unitsPerBlockOverride ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateRow(i, {
                        unitsPerBlockOverride:
                          v === "" || Number.isNaN(Number(v))
                            ? null
                            : Math.max(1, Math.floor(Number(v))),
                      });
                    }}
                  />
                </Field>
                <Field label="Notes">
                  <Input
                    value={row.notes}
                    onChange={(e) => updateRow(i, { notes: e.target.value })}
                    placeholder="Optional"
                  />
                </Field>
              </FieldGrid>

              {block && (
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-card p-3 text-xs">
                  <Stat
                    label={
                      hasOverride ? "Units per block (manual)" : "Units per block"
                    }
                    value={effectiveUnits > 0 ? `${effectiveUnits}` : "—"}
                  />
                  <Stat
                    label="Cost / unit"
                    value={formatLE(rowCost)}
                    emphasis
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`tabular-nums ${
          emphasis ? "font-semibold" : "text-muted-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
