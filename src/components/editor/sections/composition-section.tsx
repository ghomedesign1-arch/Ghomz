"use client";

import { Layers2, Plus, Trash2 } from "lucide-react";
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
import { Field } from "@/components/forms/field";
import type { EditableProduct, ProductOption } from "../types";

interface Props {
  product: EditableProduct;
  /** All other products that could be included as children. */
  available: ProductOption[];
  onChange: (compositions: EditableProduct["compositions"]) => void;
}

export function CompositionSection({ product, available, onChange }: Props) {
  // Don't let the user include themselves.
  const pickable = available.filter((p) => p.id !== product.id);
  const usedIds = new Set(product.compositions.map((c) => c.childProductId));
  const availableForAdd = pickable.filter((p) => !usedIds.has(p.id));
  const productMap = new Map(pickable.map((p) => [p.id, p]));

  function addRow() {
    if (availableForAdd.length === 0) return;
    onChange([
      ...product.compositions,
      { childProductId: availableForAdd[0].id, quantity: 1 },
    ]);
  }
  function updateRow(
    index: number,
    patch: Partial<EditableProduct["compositions"][number]>,
  ) {
    onChange(
      product.compositions.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    );
  }
  function removeRow(index: number) {
    onChange(product.compositions.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers2 className="h-4 w-4" /> Included products (bundle)
          </CardTitle>
          <CardDescription>
            Combine other products into this one. A &quot;Fluff Set&quot; might
            include <em>1× L-shape sofa + 6× chairs</em> — the set inherits
            each child&apos;s full cost.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRow}
          disabled={availableForAdd.length === 0}
        >
          <Plus className="h-4 w-4" /> Add sub-product
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {product.compositions.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No sub-products. Add this product&apos;s own BOM above, or include
            existing products to make this a bundle.
          </div>
        )}
        {product.compositions.map((row, i) => {
          const otherUsed = new Set(
            product.compositions
              .filter((_, idx) => idx !== i)
              .map((x) => x.childProductId),
          );
          const options = pickable.filter(
            (p) => p.id === row.childProductId || !otherUsed.has(p.id),
          );
          const child = productMap.get(row.childProductId);
          return (
            <div
              key={i}
              className="grid grid-cols-1 items-start gap-3 rounded-xl border bg-secondary/30 p-4 sm:grid-cols-[1fr_140px_auto]"
            >
              <Field label="Sub-product">
                <Select
                  value={row.childProductId}
                  onValueChange={(v) => updateRow(i, { childProductId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({p.sku})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {child && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Inherits this product&apos;s full unit cost
                  </p>
                )}
              </Field>
              <Field label="Quantity">
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={row.quantity}
                  onChange={(e) =>
                    updateRow(i, { quantity: Number(e.target.value) })
                  }
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(i)}
                aria-label="Remove sub-product"
                className="mt-5"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
