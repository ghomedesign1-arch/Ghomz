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
import type { EditableProduct, PocketCoilRef } from "../types";

interface Props {
  product: EditableProduct;
  pocketCoils: PocketCoilRef[];
  onChange: (rows: EditableProduct["pocketCoils"]) => void;
}

export function PocketCoilSection({ product, pocketCoils, onChange }: Props) {
  const coilMap = new Map(pocketCoils.map((c) => [c.id, c]));
  const usedIds = new Set(product.pocketCoils.map((p) => p.pocketCoilId));
  const availableForAdd = pocketCoils.filter((c) => !usedIds.has(c.id));

  function addRow() {
    if (availableForAdd.length === 0) return;
    onChange([
      ...product.pocketCoils,
      { pocketCoilId: availableForAdd[0].id, quantity: 1 },
    ]);
  }
  function updateRow(
    index: number,
    patch: Partial<EditableProduct["pocketCoils"][number]>,
  ) {
    onChange(
      product.pocketCoils.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    );
  }
  function removeRow(index: number) {
    onChange(product.pocketCoils.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Pocket coils</CardTitle>
          <CardDescription>
            Springs counted by piece. Cost = quantity × cost / coil.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRow}
          disabled={availableForAdd.length === 0}
        >
          <Plus className="h-4 w-4" /> Add coil line
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {product.pocketCoils.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No pocket coil lines yet.
            {pocketCoils.length === 0 && (
              <>
                {" "}
                Create a coil first in <strong>Pocket coils</strong> from the
                sidebar.
              </>
            )}
          </div>
        )}
        {product.pocketCoils.map((row, i) => {
          const coil = coilMap.get(row.pocketCoilId);
          const lineCost = coil ? row.quantity * coil.costPerUnit : 0;
          const otherUsed = new Set(
            product.pocketCoils
              .filter((_, idx) => idx !== i)
              .map((x) => x.pocketCoilId),
          );
          const pickable = pocketCoils.filter(
            (c) => c.id === row.pocketCoilId || !otherUsed.has(c.id),
          );
          return (
            <div
              key={i}
              className="grid grid-cols-1 items-start gap-3 rounded-xl border bg-secondary/30 p-4 sm:grid-cols-[1fr_120px_140px_140px_auto]"
            >
              <Field label="Pocket coil">
                <Select
                  value={row.pocketCoilId}
                  onValueChange={(v) =>
                    updateRow(i, { pocketCoilId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pickable.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Quantity">
                <Input
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) =>
                    updateRow(i, { quantity: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Cost / coil">
                <div className="flex h-10 items-center justify-end rounded-lg bg-card px-3 text-sm tabular-nums">
                  {coil ? formatLE(coil.costPerUnit) : "—"}
                </div>
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
                aria-label="Remove pocket coil"
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
