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
import { Field } from "@/components/forms/field";
import { formatLE } from "@/lib/costing";
import type { EditableProduct, FabricRef } from "../types";

interface Props {
  product: EditableProduct;
  fabrics: FabricRef[];
  onChange: (fabrics: EditableProduct["fabrics"]) => void;
}

export function FabricSection({ product, fabrics, onChange }: Props) {
  const fabricMap = new Map(fabrics.map((f) => [f.id, f]));
  const usedIds = new Set(product.fabrics.map((f) => f.fabricId));
  const availableForAdd = fabrics.filter((f) => !usedIds.has(f.id));

  function addRow() {
    if (availableForAdd.length === 0) return;
    onChange([
      ...product.fabrics,
      { fabricId: availableForAdd[0].id, meters: 1 },
    ]);
  }
  function updateRow(
    index: number,
    patch: Partial<EditableProduct["fabrics"][number]>,
  ) {
    onChange(
      product.fabrics.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    );
  }
  function removeRow(index: number) {
    onChange(product.fabrics.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Fabric</CardTitle>
          <CardDescription>
            Each fabric can appear once per product. Cost = meters × cost/m.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRow}
          disabled={availableForAdd.length === 0}
        >
          <Plus className="h-4 w-4" /> Add fabric line
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {product.fabrics.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No fabric lines yet.
          </div>
        )}
        {product.fabrics.map((row, i) => {
          const fabric = fabricMap.get(row.fabricId);
          const lineCost = fabric ? row.meters * fabric.costPerMeter : 0;
          const otherUsed = new Set(
            product.fabrics
              .filter((_, idx) => idx !== i)
              .map((x) => x.fabricId),
          );
          const pickable = fabrics.filter(
            (f) => f.id === row.fabricId || !otherUsed.has(f.id),
          );
          return (
            <div
              key={i}
              className="grid grid-cols-1 items-start gap-3 rounded-xl border bg-secondary/30 p-4 sm:grid-cols-[1fr_120px_120px_auto]"
            >
              <Field label="Fabric">
                <Select
                  value={row.fabricId}
                  onValueChange={(v) => updateRow(i, { fabricId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pickable.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                        {f.collection && (
                          <span className="text-xs text-muted-foreground">
                            {" "}· {f.collection}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Meters">
                <Input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={row.meters}
                  onChange={(e) =>
                    updateRow(i, { meters: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Subtotal">
                <div className="flex h-10 items-center justify-end rounded-lg bg-card px-3 text-sm font-medium tabular-nums">
                  {formatLE(lineCost)}
                </div>
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(i)}
                aria-label="Remove fabric"
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
