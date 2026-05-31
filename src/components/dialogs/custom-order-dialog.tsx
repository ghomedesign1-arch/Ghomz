"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGrid } from "@/components/forms/field";
import { apiPost } from "@/lib/api-client";
import { formatLE } from "@/lib/costing";

interface LineItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: string;
  unitCost: string;
}

function makeItem(): LineItem {
  return { id: crypto.randomUUID(), name: "", description: "", quantity: 1, unitPrice: "", unitCost: "" };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_OPTIONS = [
  { value: "PENDING",     label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED",   label: "Completed" },
  { value: "CANCELLED",   label: "Cancelled" },
];

interface CustomOrderDialogProps {
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
}

export function CustomOrderDialog({
  triggerLabel = "Custom order",
  triggerVariant = "outline",
}: CustomOrderDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Client info
  const [clientName, setClientName]       = React.useState("");
  const [clientPhone, setClientPhone]     = React.useState("");
  const [clientAddress, setClientAddress] = React.useState("");

  // Order meta
  const [status, setStatus]         = React.useState("PENDING");
  const [deliveryDate, setDeliveryDate] = React.useState("");
  const [deposit, setDeposit]       = React.useState("");
  const [notes, setNotes]           = React.useState("");

  // Line items
  const [items, setItems] = React.useState<LineItem[]>([makeItem()]);

  // Reset on open
  React.useEffect(() => {
    if (!open) return;
    setClientName("");
    setClientPhone("");
    setClientAddress("");
    setStatus("PENDING");
    setDeliveryDate("");
    setDeposit("");
    setNotes("");
    setItems([makeItem()]);
  }, [open]);

  function addItem() {
    setItems((prev) => [...prev, makeItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem<K extends keyof LineItem>(id: string, key: K, val: LineItem[K]) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [key]: val } : i)));
  }

  const subtotal    = items.reduce((s, i) => s + i.quantity * (parseFloat(i.unitPrice) || 0), 0);
  const totalCost   = items.reduce((s, i) => s + i.quantity * (parseFloat(i.unitCost)  || 0), 0);
  const profit      = subtotal - totalCost;
  const marginPct   = subtotal > 0 ? (profit / subtotal) * 100 : 0;
  const depositNum  = parseFloat(deposit) || 0;
  const balance     = subtotal - depositNum;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) {
      toast.error("Client name is required");
      return;
    }
    const validItems = items.filter((i) => i.name.trim() && parseFloat(i.unitPrice) > 0);
    if (!validItems.length) {
      toast.error("Add at least one item with a name and price");
      return;
    }

    setSubmitting(true);
    try {
      const order = await apiPost<{ id: string; invoiceNo: string }>("/api/custom-orders", {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        deposit: depositNum || undefined,
        notes: notes.trim() || undefined,
        status,
        items: validItems.map((i) => ({
          name: i.name.trim(),
          description: i.description.trim() || undefined,
          quantity: i.quantity,
          unitPrice: parseFloat(i.unitPrice),
          unitCost: parseFloat(i.unitCost) || 0,
        })),
      });
      toast.success(`Order ${order.invoiceNo} created`);
      setOpen(false);
      router.refresh();
      // Open invoice in new tab
      window.open(`/custom-orders/${order.id}/invoice`, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <FileText className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>New custom order</DialogTitle>
          <DialogDescription>
            Free-form order with custom prices. An invoice is generated automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* ── Client info ── */}
          <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
            <Field label="Client name *">
              <Input
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ahmed Hassan"
              />
            </Field>
            <FieldGrid cols={2}>
              <Field label="Mobile number">
                <Input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+20 10 0000 0000"
                />
              </Field>
              <Field label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGrid>
            <Field label="Delivery address">
              <Input
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="15 Tahrir Square, Cairo"
              />
            </Field>
            <Field label="Delivery date">
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </Field>
          </div>

          {/* ── Line items ── */}
          <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</p>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>

            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_88px_88px_32px] gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
              <span>Product name</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Cost/unit</span>
              <span className="text-right">Price/unit</span>
              <span />
            </div>

            <div className="space-y-2">
              {items.map((item) => {
                const price  = parseFloat(item.unitPrice) || 0;
                const cost   = parseFloat(item.unitCost)  || 0;
                const lineProfit = (price - cost) * item.quantity;
                const lineMargin = price > 0 ? ((price - cost) / price) * 100 : 0;
                const profitColor =
                  cost === 0        ? undefined
                  : lineProfit <= 0 ? "#dc2626"
                  : lineMargin >= 25 ? "#16a34a"
                  : lineMargin >= 20 ? "#d97706"
                  : "#dc2626";

                return (
                  <div key={item.id} className="space-y-1">
                    <div className="grid grid-cols-[1fr_80px_88px_88px_32px] gap-2 items-center">
                      <Input
                        placeholder="Sofa 3-seater"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                        className="h-8 text-sm text-center"
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={item.unitCost}
                        onChange={(e) => updateItem(item.id, "unitCost", e.target.value)}
                        className="h-8 text-sm text-right"
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                        className="h-8 text-sm text-right"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {/* Description + per-line profit */}
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-center pl-0">
                      <Input
                        placeholder="Colour, size, notes…"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        className="h-7 text-xs text-muted-foreground"
                      />
                      {cost > 0 && price > 0 && (
                        <span className="text-[11px] tabular-nums whitespace-nowrap pr-9" style={{ color: profitColor }}>
                          {lineProfit >= 0 ? "+" : ""}{formatLE(lineProfit)} ({lineMargin.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Payment ── */}
          <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums font-semibold">{formatLE(subtotal)}</span>
            </div>

            {/* Profit summary */}
            {totalCost > 0 && subtotal > 0 && (() => {
              const profitColor =
                marginPct >= 25 ? "#16a34a"
                : marginPct >= 20 ? "#d97706"
                : "#dc2626";
              return (
                <div
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: profitColor + "18" }}
                >
                  <div>
                    <div className="text-xs font-semibold" style={{ color: profitColor }}>Order profit</div>
                    <div className="text-[10px] text-muted-foreground">Production cost {formatLE(totalCost)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums" style={{ color: profitColor }}>
                      {profit >= 0 ? "+" : ""}{formatLE(profit)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{marginPct.toFixed(1)}% margin</div>
                  </div>
                </div>
              );
            })()}
            <FieldGrid cols={2}>
              <Field label="Deposit received (EGP)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                />
              </Field>
              <div className="flex flex-col justify-end pb-1">
                <div className="text-xs text-muted-foreground mb-1">Balance due</div>
                <div className={`tabular-nums font-semibold text-sm ${balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`}>
                  {formatLE(Math.max(0, balance))}
                </div>
              </div>
            </FieldGrid>
            <Field label="Notes">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions, colour preferences…"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create & open invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
