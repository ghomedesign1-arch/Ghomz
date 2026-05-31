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

const KINDS = [
  { value: "FIBER", label: "Fiber" },
  { value: "PACKAGING", label: "Packaging" },
  { value: "EXTRA", label: "Extra" },
];

export interface BulkFormValues {
  id?: string;
  name: string;
  kind: string;
  costPerKg: number;
  stockKg: number;
  reorderLevel: number;
}

const DEFAULTS: BulkFormValues = {
  name: "",
  kind: "FIBER",
  costPerKg: 250,
  stockKg: 0,
  reorderLevel: 0,
};

interface BulkFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: BulkFormValues;
}

export function BulkFormDialog({
  open,
  onOpenChange,
  initial,
}: BulkFormDialogProps) {
  const router = useRouter();
  const [form, setForm] = React.useState(initial ?? DEFAULTS);
  const [submitting, setSubmitting] = React.useState(false);
  const isEdit = !!initial?.id;

  React.useEffect(() => {
    if (open) setForm(initial ?? DEFAULTS);
  }, [open, initial]);

  function set<K extends keyof BulkFormValues>(
    key: K,
    value: BulkFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        kind: form.kind,
        costPerKg: form.costPerKg,
        stockKg: form.stockKg,
        reorderLevel: form.reorderLevel,
      };
      if (isEdit && initial?.id) {
        await apiPatch(`/api/materials/${initial.id}`, payload);
        toast.success(`Updated "${form.name}"`);
      } else {
        await apiPost("/api/materials", payload);
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
            {isEdit ? `Edit ${initial?.name ?? "material"}` : "New bulk material"}
          </DialogTitle>
          <DialogDescription>
            Cost is stored in EGP per kilogram. Product BOMs consume in grams.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGrid cols={2}>
            <Field label="Name">
              <Input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Polyester fiber"
              />
            </Field>
            <Field label="Type">
              <Select value={form.kind} onValueChange={(v) => set("kind", v)}>
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
          </FieldGrid>
          <FieldGrid cols={3}>
            <Field label="Cost / kg">
              <Input
                type="number"
                step="0.01"
                min={0}
                required
                value={form.costPerKg}
                onChange={(e) => set("costPerKg", Number(e.target.value))}
              />
            </Field>
            <Field label="Stock (kg)">
              <Input
                type="number"
                step="0.1"
                min={0}
                value={form.stockKg}
                onChange={(e) => set("stockKg", Number(e.target.value))}
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
                  : "Add material"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
