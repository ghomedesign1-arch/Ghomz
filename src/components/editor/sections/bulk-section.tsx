"use client";

import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { BulkRef, EditableProduct } from "../types";

interface Props {
  product: EditableProduct;
  bulkMaterials: BulkRef[];
  onChange: (bulks: EditableProduct["bulkMaterials"]) => void;
}

export function BulkSection({ product, bulkMaterials, onChange }: Props) {
  const bulkMap = new Map(bulkMaterials.map((b) => [b.id, b]));
  const usedIds = new Set(product.bulkMaterials.map((b) => b.bulkMaterialId));
  const availableForAdd = bulkMaterials.filter((b) => !usedIds.has(b.id));

  function addRow() {
    if (availableForAdd.length === 0) return;
    onChange([
      ...product.bulkMaterials,
      { bulkMaterialId: availableForAdd[0].id, grams: 500 },
    ]);
  }
  function updateRow(
    index: number,
    patch: Partial<EditableProduct["bulkMaterials"][number]>,
  ) {
    onChange(
      product.bulkMaterials.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    );
  }
  function removeRow(index: number) {
    onChange(product.bulkMaterials.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Fiber, packaging & extras</CardTitle>
          <CardDescription>
            Stored in grams per unit. Cost = (grams ÷ 1000) × cost/kg.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRow}
          disabled={availableForAdd.length === 0}
        >
          <Plus className="h-4 w-4" /> Add bulk line
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {product.bulkMaterials.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No fiber / packaging lines yet.
          </div>
        )}
        {product.bulkMaterials.map((row, i) => {
          const bulk = bulkMap.get(row.bulkMaterialId);
          const lineCost = bulk ? (row.grams / 1000) * bulk.costPerKg : 0;
          const otherUsed = new Set(
            product.bulkMaterials
              .filter((_, idx) => idx !== i)
              .map((x) => x.bulkMaterialId),
          );
          const pickable = bulkMaterials.filter(
            (b) => b.id === row.bulkMaterialId || !otherUsed.has(b.id),
          );
          return (
            <div
              key={i}
              className="grid grid-cols-1 items-start gap-3 rounded-xl border bg-secondary/30 p-4 sm:grid-cols-[1fr_100px_120px_120px_auto]"
            >
              <Field label="Material">
                <Select
                  value={row.bulkMaterialId}
                  onValueChange={(v) =>
                    updateRow(i, { bulkMaterialId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pickable.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Type
                </div>
                <div className="flex h-10 items-center">
                  {bulk ? (
                    <Badge variant={bulk.kind === "FIBER" ? "info" : "secondary"}>
                      {bulk.kind}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <Field label="Grams">
                <Input
                  type="number"
                  min={1}
                  value={row.grams}
                  onChange={(e) =>
                    updateRow(i, { grams: Number(e.target.value) })
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
                aria-label="Remove bulk"
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
