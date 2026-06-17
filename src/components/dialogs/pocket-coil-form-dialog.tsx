"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { apiPatch, apiPost } from "@/lib/api-client";

export interface PocketCoilFormValues {
  id?: string;
  name: string;
  costPerUnit: number;
  stockUnits: number;
  reorderLevel: number;
  supplierId: string;
  notes: string;
}

const DEFAULTS: PocketCoilFormValues = {
  name: "",
  costPerUnit: 30,
  stockUnits: 0,
  reorderLevel: 0,
  supplierId: "",
  notes: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: { id: string; name: string }[];
  initial?: PocketCoilFormValues;
}

export function PocketCoilFormDialog({
  open,
  onOpenChange,
  suppliers,
  initial,
}: Props) {
  const router = useRouter();
  const [form, setForm] = React.useState(initial ?? DEFAULTS);
  const [submitting, setSubmitting] = React.useState(false);
  const isEdit = !!initial?.id;

  React.useEffect(() => {
    if (open) setForm(initial ?? DEFAULTS);
  }, [open, initial]);

  function set<K extends keyof PocketCoilFormValues>(
    key: K,
    value: PocketCoilFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        costPerUnit: form.costPerUnit,
        stockUnits: form.stockUnits,
        reorderLevel: form.reorderLevel,
        supplierId: form.supplierId || undefined,
        notes: form.notes || undefined,
      };
      if (isEdit && initial?.id) {
        await apiPatch(`/api/pocket-coils/${initial.id}`, payload);
        toast.success(`Updated "${form.name}"`);
      } else {
        await apiPost("/api/pocket-coils", payload);
        toast.success(`Added "${form.name}"`);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? `Edit ${initial?.name ?? "pocket coil"}`
              : "New pocket coil"}
          </DialogTitle>
          <DialogDescription>
            Springs used inside seats / beds. Cost is per individual coil.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name">
            <Input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Standard 14cm coil"
            />
          </Field>
          <FieldGrid cols={3}>
            <Field label="Cost / coil (LE)">
              <Input
                type="number"
                step="0.01"
                min={0}
                required
                value={form.costPerUnit}
                onChange={(e) => set("costPerUnit", Number(e.target.value))}
              />
            </Field>
            <Field label="Stock (coils)">
              <Input
                type="number"
                step={1}
                min={0}
                value={form.stockUnits}
                onChange={(e) => set("stockUnits", Number(e.target.value))}
              />
            </Field>
            <Field label="Reorder level">
              <Input
                type="number"
                step={1}
                min={0}
                value={form.reorderLevel}
                onChange={(e) => set("reorderLevel", Number(e.target.value))}
              />
            </Field>
          </FieldGrid>
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
          <Field label="Notes">
            <Input
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional"
            />
          </Field>
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
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add pocket coil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
