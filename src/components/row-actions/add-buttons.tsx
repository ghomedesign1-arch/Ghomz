"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { apiPost } from "@/lib/api-client";
import {
  SpongeFormDialog,
  type ProductForYield,
} from "@/components/dialogs/sponge-form-dialog";
import { FabricFormDialog } from "@/components/dialogs/fabric-form-dialog";
import { BulkFormDialog } from "@/components/dialogs/bulk-form-dialog";
import { SupplierFormDialog } from "@/components/dialogs/supplier-form-dialog";

interface Supplier {
  id: string;
  name: string;
}

export function AddSpongeButton({
  suppliers,
  products,
}: {
  suppliers: Supplier[];
  /** Products eligible for the new block's cutting plan. */
  products?: ProductForYield[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add sponge block
      </Button>
      <SpongeFormDialog
        open={open}
        onOpenChange={setOpen}
        suppliers={suppliers}
        products={products}
      />
    </>
  );
}

export function AddFabricButton({ suppliers }: { suppliers: Supplier[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add fabric
      </Button>
      <FabricFormDialog
        open={open}
        onOpenChange={setOpen}
        suppliers={suppliers}
      />
    </>
  );
}

export function AddBulkButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add material
      </Button>
      <BulkFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function AddSupplierButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add supplier
      </Button>
      <SupplierFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Product create remains slightly different — after save we navigate to the
 * editor page so the user can immediately fill out the BOM.
 */
export function AddProductButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New product
      </Button>
      <ProductQuickCreateDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(id) => router.push(`/products/${id}/edit`)}
      />
    </>
  );
}

const CATEGORIES = [
  { value: "SOFA_2_SEAT",  label: "2-Seat Sofa" },
  { value: "SOFA_3_SEAT",  label: "3-Seat Sofa" },
  { value: "L_SHAPE_SOFA", label: "L-Shape Sofa" },
  { value: "MODULAR_SOFA", label: "Modular Sofa" },
  { value: "CHAIR",        label: "Chair" },
  { value: "OUTDOOR",      label: "Outdoor" },
  { value: "KIDS_BED",     label: "Kids Bed" },
  { value: "OTTOMAN",      label: "Ottoman" },
  { value: "BEAN_SEAT",    label: "Bean Seat" },
  { value: "OTHER", label: "Other" },
];

function ProductQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    sku: "",
    name: "",
    category: "SOFA_2_SEAT",
    description: "",
    widthCm: 90,
    depthCm: 90,
    heightCm: 70,
    retailPrice: 0,
    wholesalePrice: 0,
    stockQty: 0,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await apiPost<{ id: string }>("/api/products", {
        ...form,
        description: form.description || undefined,
      });
      toast.success(`Created "${form.name}" — now add its BOM`);
      onOpenChange(false);
      onCreated(created.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create product",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>
            Create the product shell. You&apos;ll be taken to the editor to
            add sponge cuts, fabric, fiber and manufacturing lines.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGrid cols={2}>
            <Field label="SKU">
              <Input
                required
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="GH-CHR-002"
                className="uppercase tracking-wider"
              />
            </Field>
            <Field label="Name">
              <Input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
          </FieldGrid>
          <Field label="Category">
            <Select
              value={form.category}
              onValueChange={(v) => set("category", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description">
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <FieldGrid cols={3}>
            <Field label="Width (cm)">
              <Input
                type="number"
                min={1}
                step="0.1"
                required
                value={form.widthCm}
                onChange={(e) => set("widthCm", Number(e.target.value))}
              />
            </Field>
            <Field label="Depth (cm)">
              <Input
                type="number"
                min={1}
                step="0.1"
                required
                value={form.depthCm}
                onChange={(e) => set("depthCm", Number(e.target.value))}
              />
            </Field>
            <Field label="Height (cm)">
              <Input
                type="number"
                min={1}
                step="0.1"
                required
                value={form.heightCm}
                onChange={(e) => set("heightCm", Number(e.target.value))}
              />
            </Field>
          </FieldGrid>
          <FieldGrid cols={3}>
            <Field label="Retail (LE)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.retailPrice}
                onChange={(e) => set("retailPrice", Number(e.target.value))}
              />
            </Field>
            <Field label="Wholesale (LE)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.wholesalePrice}
                onChange={(e) =>
                  set("wholesalePrice", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Stock qty">
              <Input
                type="number"
                min={0}
                value={form.stockQty}
                onChange={(e) => set("stockQty", Number(e.target.value))}
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
              {submitting ? "Saving…" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
