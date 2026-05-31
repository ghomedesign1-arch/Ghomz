"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { Field } from "@/components/forms/field";
import { Separator } from "@/components/ui/separator";
import { apiPost, apiPut } from "@/lib/api-client";
import { formatLE } from "@/lib/costing";

export interface PurchaseResources {
  suppliers: { id: string; name: string }[];
}

type ItemKind = "SPONGE" | "FABRIC" | "BULK" | "MARKETING" | "OTHER";

interface ItemRow {
  kind: ItemKind;
  itemName: string;
  itemDescription: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseFormInitial {
  id: string;
  supplierId: string;
  reference: string;
  notes: string;
  purchaseDate: string;
  items: ItemRow[];
}

interface PurchaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resources: PurchaseResources;
  initial?: PurchaseFormInitial;
  /** Default Kind for new item rows. Lets the "Record sponge purchase" /
   *  "Record fabric purchase" buttons pre-pick the right category. */
  defaultKind?: ItemKind;
  /** When true, all items are forced to the defaultKind — the dropdown is
   *  hidden so users can't accidentally mix kinds within a single purchase. */
  lockKind?: boolean;
}

const UNIT_LABEL: Record<ItemKind, string> = {
  SPONGE: "blocks",
  FABRIC: "meters",
  BULK: "kg",
  MARKETING: "units",
  OTHER: "units",
};

const KIND_LABEL: Record<ItemKind, string> = {
  SPONGE: "Sponge",
  FABRIC: "Fabric",
  BULK: "Bulk",
  MARKETING: "Marketing",
  OTHER: "Other",
};

function emptyRow(kind: ItemKind = "SPONGE"): ItemRow {
  return {
    kind,
    itemName: "",
    itemDescription: "",
    quantity: 1,
    unitCost: 0,
  };
}

export function PurchaseFormDialog({
  open,
  onOpenChange,
  resources,
  initial,
  defaultKind = "SPONGE",
  lockKind = false,
}: PurchaseFormDialogProps) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState(
    initial?.supplierId ?? resources.suppliers[0]?.id ?? "",
  );
  const [reference, setReference] = React.useState(initial?.reference ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [purchaseDate, setPurchaseDate] = React.useState(
    initial?.purchaseDate ?? today(),
  );
  const [items, setItems] = React.useState<ItemRow[]>(() =>
    initial?.items.length ? initial.items : [emptyRow(defaultKind)],
  );

  React.useEffect(() => {
    if (open) {
      setSupplierId(initial?.supplierId ?? resources.suppliers[0]?.id ?? "");
      setReference(initial?.reference ?? "");
      setNotes(initial?.notes ?? "");
      setPurchaseDate(initial?.purchaseDate ?? today());
      setItems(
        initial?.items.length ? initial.items : [emptyRow(defaultKind)],
      );
    }
  }, [open, initial, resources, defaultKind]);

  const total = items.reduce((a, i) => a + i.quantity * i.unitCost, 0);

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  function addRow() {
    setItems((prev) => [...prev, emptyRow(defaultKind)]);
  }
  function removeRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (items.some((i) => !i.itemName.trim())) {
      toast.error("Every item needs a name");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        supplierId: supplierId || undefined,
        reference: reference || undefined,
        notes: notes || undefined,
        purchaseDate: purchaseDate
          ? new Date(purchaseDate).toISOString()
          : undefined,
        items: items.map((i) => ({
          kind: i.kind,
          itemName: i.itemName.trim(),
          itemDescription: i.itemDescription.trim() || undefined,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      };
      if (isEdit && initial?.id) {
        await apiPut(`/api/purchases/${initial.id}`, payload);
        toast.success("Purchase updated");
      } else {
        await apiPost("/api/purchases", payload);
        toast.success(`Recorded purchase · ${formatLE(total)}`);
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit purchase" : "Record a purchase"}
          </DialogTitle>
          <DialogDescription>
            A standalone log of what you bought from a supplier. Doesn&apos;t
            touch sponge / fabric / bulk inventory or product costs — type any
            item name and price freely.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_160px]">
            <Field label="Supplier">
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resources.suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference (invoice #)">
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="INV-2026-001"
              />
            </Field>
            <Field label="Purchase date">
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Notes">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Items</div>
                <div className="text-xs text-muted-foreground">
                  Type anything you bought — sponge blocks, fabric rolls, fiber,
                  packaging, accessories.
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addRow}
              >
                <Plus className="h-4 w-4" /> Add item
              </Button>
            </div>

            {items.map((row, i) => (
              <ItemRowEditor
                key={i}
                row={row}
                lockKind={lockKind}
                onChange={(patch) => updateItem(i, patch)}
                onRemove={items.length > 1 ? () => removeRow(i) : undefined}
              />
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-secondary/40 p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="font-display text-2xl font-semibold tabular-nums">
              {formatLE(total)}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || total <= 0}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Record purchase"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemRowEditor({
  row,
  lockKind,
  onChange,
  onRemove,
}: {
  row: ItemRow;
  lockKind?: boolean;
  onChange: (patch: Partial<ItemRow>) => void;
  onRemove?: () => void;
}) {
  const subtotal = row.quantity * row.unitCost;
  return (
    <div className="space-y-3 rounded-xl border bg-secondary/30 p-4">
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[160px_1fr_auto]">
        <Field label="Kind">
          {lockKind ? (
            <div className="flex h-10 items-center justify-start rounded-lg border bg-card px-3 text-sm font-medium">
              {KIND_LABEL[row.kind]}
            </div>
          ) : (
            <Select
              value={row.kind}
              onValueChange={(v) => onChange({ kind: v as ItemKind })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Item name">
          <Input
            required
            value={row.itemName}
            onChange={(e) => onChange({ itemName: e.target.value })}
            placeholder={
              row.kind === "SPONGE"
                ? "e.g. Yellow 26 Soft block 240×200×120"
                : row.kind === "FABRIC"
                  ? "e.g. Twix Reef sand velvet"
                  : row.kind === "BULK"
                    ? "e.g. Polyester fiber"
                    : row.kind === "MARKETING"
                      ? "e.g. Facebook ads, Instagram campaign…"
                      : "e.g. Glue, staples, labels…"
            }
          />
        </Field>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remove item"
            className="mt-5"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <div />
        )}
      </div>

      <Field label="Description (optional)">
        <Input
          value={row.itemDescription}
          onChange={(e) => onChange({ itemDescription: e.target.value })}
          placeholder="e.g. density 26, color yellow"
        />
      </Field>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_1fr_1fr]">
        <Field label={`Qty (${UNIT_LABEL[row.kind]})`}>
          <Input
            type="number"
            min={0}
            step={row.kind === "SPONGE" ? 1 : 0.1}
            value={row.quantity}
            onChange={(e) => onChange({ quantity: Number(e.target.value) })}
          />
        </Field>
        <Field label="Unit cost (LE)">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={row.unitCost}
            onChange={(e) => onChange({ unitCost: Number(e.target.value) })}
          />
        </Field>
        <Field label="Subtotal">
          <div className="flex h-10 items-center justify-end rounded-lg bg-card px-3 text-sm font-medium tabular-nums">
            {formatLE(subtotal)}
          </div>
        </Field>
      </div>
    </div>
  );
}

/** Today's date in the YYYY-MM-DD format the native date input expects. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
