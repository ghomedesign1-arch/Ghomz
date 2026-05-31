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

export interface FabricFormValues {
  id?: string;
  name: string;
  collection: string;
  color: string;
  texture: string;
  costPerMeter: number;
  stockMeters: number;
  reorderLevel: number;
  supplierId: string;
}

const DEFAULTS: FabricFormValues = {
  name: "",
  collection: "",
  color: "",
  texture: "",
  costPerMeter: 210,
  stockMeters: 0,
  reorderLevel: 0,
  supplierId: "",
};

interface FabricFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: { id: string; name: string }[];
  initial?: FabricFormValues;
}

export function FabricFormDialog({
  open,
  onOpenChange,
  suppliers,
  initial,
}: FabricFormDialogProps) {
  const router = useRouter();
  const [form, setForm] = React.useState(initial ?? DEFAULTS);
  const [submitting, setSubmitting] = React.useState(false);
  const isEdit = !!initial?.id;

  React.useEffect(() => {
    if (open) setForm(initial ?? DEFAULTS);
  }, [open, initial]);

  function set<K extends keyof FabricFormValues>(
    key: K,
    value: FabricFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        collection: form.collection || undefined,
        color: form.color || undefined,
        texture: form.texture || undefined,
        costPerMeter: form.costPerMeter,
        stockMeters: form.stockMeters,
        reorderLevel: form.reorderLevel,
        supplierId: form.supplierId || undefined,
      };
      if (isEdit && initial?.id) {
        await apiPatch(`/api/fabrics/${initial.id}`, payload);
        toast.success(`Updated "${form.name}"`);
      } else {
        await apiPost("/api/fabrics", payload);
        toast.success(`Added fabric "${form.name}"`);
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
            {isEdit ? `Edit ${initial?.name ?? "fabric"}` : "New fabric"}
          </DialogTitle>
          <DialogDescription>
            Stock in meters · cost in EGP per meter
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGrid cols={2}>
            <Field label="Name">
              <Input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Twix Reef"
              />
            </Field>
            <Field label="Collection">
              <Input
                value={form.collection}
                onChange={(e) => set("collection", e.target.value)}
              />
            </Field>
          </FieldGrid>
          <FieldGrid cols={2}>
            <Field label="Color">
              <Input
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
              />
            </Field>
            <Field label="Texture">
              <Input
                value={form.texture}
                onChange={(e) => set("texture", e.target.value)}
              />
            </Field>
          </FieldGrid>
          <FieldGrid cols={3}>
            <Field label="Cost / meter">
              <Input
                type="number"
                step="0.01"
                min={0}
                required
                value={form.costPerMeter}
                onChange={(e) => set("costPerMeter", Number(e.target.value))}
              />
            </Field>
            <Field label="Stock (m)">
              <Input
                type="number"
                step="0.1"
                min={0}
                value={form.stockMeters}
                onChange={(e) => set("stockMeters", Number(e.target.value))}
              />
            </Field>
            <Field label="Reorder level">
              <Input
                type="number"
                step="0.1"
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
                  : "Add fabric"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
