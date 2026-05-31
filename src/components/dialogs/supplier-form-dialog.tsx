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
import { Field, FieldGrid } from "@/components/forms/field";
import { apiPatch, apiPost } from "@/lib/api-client";

export interface SupplierFormValues {
  id?: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const DEFAULTS: SupplierFormValues = {
  name: "",
  contact: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: SupplierFormValues;
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  initial,
}: SupplierFormDialogProps) {
  const router = useRouter();
  const [form, setForm] = React.useState(initial ?? DEFAULTS);
  const [submitting, setSubmitting] = React.useState(false);
  const isEdit = !!initial?.id;

  React.useEffect(() => {
    if (open) setForm(initial ?? DEFAULTS);
  }, [open, initial]);

  function set<K extends keyof SupplierFormValues>(
    key: K,
    value: SupplierFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit && initial?.id) {
        await apiPatch(`/api/suppliers/${initial.id}`, form);
        toast.success(`Updated "${form.name}"`);
      } else {
        await apiPost("/api/suppliers", form);
        toast.success(`Added supplier "${form.name}"`);
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
            {isEdit ? `Edit ${initial?.name ?? "supplier"}` : "New supplier"}
          </DialogTitle>
          <DialogDescription>
            Vendors providing sponge, fabric or bulk materials.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name">
            <Input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <FieldGrid cols={2}>
            <Field label="Contact person">
              <Input
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </FieldGrid>
          <FieldGrid cols={2}>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Address">
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
          </FieldGrid>
          <Field label="Notes">
            <Input
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
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
              {submitting
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Add supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
