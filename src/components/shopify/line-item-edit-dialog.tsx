"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EffectiveLineItem, ShopifyOrderMeta } from "@/lib/shopify";

export function LineItemEditDialog({
  orderId,
  item,
  currency,
  onSaved,
}: {
  orderId: number;
  item: EffectiveLineItem;
  currency: string;
  onSaved: (next: ShopifyOrderMeta) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [variant, setVariant] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    // Pre-fill form inputs with the current effective values so a save
    // without edits is a no-op.
    setTitle(item.isCustom ? item.title : "");
    setVariant(item.isCustom ? item.variantTitle ?? "" : "");
    setPrice(item.isCustom ? String(item.unitPrice) : "");
    setQuantity(item.isCustom ? String(item.quantity) : "");
    setNote(item.note ?? "");
  }, [open, item]);

  async function save() {
    setSaving(true);
    try {
      const override: Record<string, unknown> = {
        customTitle: title.trim() || null,
        customVariant: variant.trim() || null,
        customPrice: price === "" ? null : Number(price),
        customQuantity: quantity === "" ? null : Number(quantity),
        note: note.trim() || null,
      };
      if (
        override.customPrice !== null &&
        (!Number.isFinite(override.customPrice) ||
          (override.customPrice as number) < 0)
      ) {
        toast.error("Price must be a positive number");
        return;
      }
      if (
        override.customQuantity !== null &&
        (!Number.isFinite(override.customQuantity) ||
          (override.customQuantity as number) < 0)
      ) {
        toast.error("Quantity must be a positive number");
        return;
      }
      const res = await fetch(`/api/shopify/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setLineOverride: {
            lineItemId: item.id,
            override,
          },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Save failed");
        return;
      }
      onSaved(payload);
      toast.success("Line item updated");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      const res = await fetch(`/api/shopify/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setLineOverride: { lineItemId: item.id, override: null },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Reset failed");
        return;
      }
      onSaved(payload);
      toast.success("Reverted to original Shopify values");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          title="Customize this line item"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit line item</DialogTitle>
          <DialogDescription>
            Override the Shopify details for this line. The original data
            stays in Shopify untouched — only the ERP view and the invoice
            PDF use the override.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-secondary/50 p-3 text-xs">
            <div className="mb-1 font-medium uppercase tracking-wide text-muted-foreground">
              Original from Shopify
            </div>
            <div>{item.original.title}</div>
            {item.original.variantTitle && (
              <div className="text-muted-foreground">
                {item.original.variantTitle}
              </div>
            )}
            <div className="mt-1 text-muted-foreground">
              {item.original.quantity} × {item.original.unitPrice.toLocaleString()} {currency}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Product name">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={item.original.title}
              />
            </Field>
            <Field label="Variant (size / color / etc.)">
              <Input
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                placeholder={item.original.variantTitle ?? ""}
              />
            </Field>
            <Field label={`Unit price (${currency})`}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={String(item.original.unitPrice)}
              />
            </Field>
            <Field label="Quantity">
              <Input
                type="number"
                step="1"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={String(item.original.quantity)}
              />
            </Field>
          </div>

          <Field label="Note (internal — shown on the ERP card)">
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Customer requested wider frame"
            />
          </Field>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {item.isCustom && (
              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={saving}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to Shopify
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save override"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
