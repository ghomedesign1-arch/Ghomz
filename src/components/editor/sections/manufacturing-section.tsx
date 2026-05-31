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
import type { EditableProduct } from "../types";

const KINDS = [
  { value: "LABOR", label: "Labor" },
  { value: "SEWING", label: "Sewing" },
  { value: "COMPRESSION", label: "Compression" },
  { value: "PACKAGING_LABOR", label: "Packaging labor" },
  { value: "TRANSPORT", label: "Transportation" },
  { value: "FIXED_FEE", label: "Fixed fee" },
  { value: "OTHER", label: "Other" },
] as const;

interface Props {
  product: EditableProduct;
  onChange: (lines: EditableProduct["manufacturing"]) => void;
}

export function ManufacturingSection({ product, onChange }: Props) {
  function addRow() {
    onChange([
      ...product.manufacturing,
      { kind: "LABOR", label: "Labor", amount: 0 },
    ]);
  }
  function updateRow(
    index: number,
    patch: Partial<EditableProduct["manufacturing"][number]>,
  ) {
    onChange(
      product.manufacturing.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    );
  }
  function removeRow(index: number) {
    onChange(product.manufacturing.filter((_, i) => i !== index));
  }

  const total = product.manufacturing.reduce((a, m) => a + m.amount, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Manufacturing lines</CardTitle>
          <CardDescription>
            Labor, sewing, compression, packaging labor, transport, fixed
            fees. Total: <span className="tabular-nums">{formatLE(total)}</span>
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRow}
        >
          <Plus className="h-4 w-4" /> Add line
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {product.manufacturing.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No manufacturing lines yet.
          </div>
        )}
        {product.manufacturing.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-1 items-start gap-3 rounded-xl border bg-secondary/30 p-4 sm:grid-cols-[180px_1fr_140px_auto]"
          >
            <Field label="Kind">
              <Select
                value={row.kind}
                onValueChange={(v) =>
                  updateRow(i, {
                    kind: v as EditableProduct["manufacturing"][number]["kind"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Label">
              <Input
                value={row.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
              />
            </Field>
            <Field label="Amount (LE)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.amount}
                onChange={(e) =>
                  updateRow(i, { amount: Number(e.target.value) })
                }
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(i)}
              aria-label="Remove line"
              className="mt-5"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
