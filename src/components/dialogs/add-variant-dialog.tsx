"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitBranch } from "lucide-react";
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
import { Field, FieldGrid } from "@/components/forms/field";
import { apiPost } from "@/lib/api-client";

interface Props {
  /** The product this variant belongs to (the parent, or if already a variant, the sibling's parent) */
  parentId: string;
  parentName: string;
  /** Pre-fill from the parent product */
  defaults: {
    category: string;
    widthCm: number;
    depthCm: number;
    heightCm: number;
  };
}

export function AddVariantDialog({ parentId, parentName, defaults }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [variantName, setVariantName] = React.useState("");
  const [sku, setSku]                 = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!variantName.trim() || !sku.trim()) return;
    setSubmitting(true);
    try {
      const created = await apiPost("/api/products", {
        sku:           sku.trim(),
        name:          parentName,          // same family name
        category:      defaults.category,
        widthCm:       defaults.widthCm,
        depthCm:       defaults.depthCm,
        heightCm:      defaults.heightCm,
        retailPrice:   0,
        wholesalePrice: 0,
        stockQty:      0,
        parentId,
        variantName:   variantName.trim(),
      });
      toast.success(`Variant "${variantName}" created — set up its BOM now`);
      setOpen(false);
      router.push(`/products/${(created as { id: string }).id}/edit`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create variant");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GitBranch className="h-4 w-4" /> Add variant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add variant — {parentName}</DialogTitle>
          <DialogDescription>
            Create a new variant of this product family with its own BOM and pricing.
            Examples: Classic, Premium, Deluxe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGrid cols={2}>
            <Field label="Variant name" hint='e.g. "Classic", "Premium"'>
              <Input
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                placeholder="Premium"
                autoFocus
                required
              />
            </Field>
            <Field label="SKU" hint="Must be unique">
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="GH-BTR-002-P"
                required
              />
            </Field>
          </FieldGrid>

          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Inherited from parent</p>
            <p>Category · {defaults.category.replace(/_/g, " ")}</p>
            <p>Dimensions · {defaults.widthCm} × {defaults.depthCm} × {defaults.heightCm} cm</p>
            <p className="text-xs">You can change these in the BOM editor after creating.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !variantName.trim() || !sku.trim()}>
              {submitting ? "Creating…" : "Create & open BOM editor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
