"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Factory, PackageCheck } from "lucide-react";
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

export interface FabricLine {
  fabricId: string;
  fabricName: string;
  meters: number;
  defaultCostPerMeter: number;
}

export interface AvailableFabric {
  id: string;
  name: string;
  costPerMeter: number;
}

export interface ProductionRunOption {
  id: string;
  sku: string;
  name: string;
  unitCost: number;
  retailPrice: number;
  wholesalePrice: number;
  maxFeasible: number;
  constraints: { label: string; have: string; need: string; ok: boolean }[];
  fabricLines: FabricLine[];
  nonFabricCost: number;
}

interface ProductionRunDialogProps {
  options: ProductionRunOption[];
  availableFabrics: AvailableFabric[];
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  defaultProductId?: string;
}

const PRIORITY_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH",   label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const STATUS_OPTIONS = [
  { value: "DRAFT",       label: "Draft" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED",   label: "Completed" },
  { value: "CANCELLED",   label: "Cancelled" },
];

// Today's date as YYYY-MM-DD for date inputs
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ProductionRunDialog({
  options,
  availableFabrics,
  triggerLabel = "Start a run",
  triggerVariant = "default",
  defaultProductId,
}: ProductionRunDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Core fields
  const [productId, setProductId] = React.useState(
    defaultProductId ?? options[0]?.id ?? "",
  );
  const [quantity, setQuantity]     = React.useState(1);
  const [status, setStatus]         = React.useState("IN_PROGRESS");
  const [priority, setPriority]     = React.useState("NORMAL");
  const [notes, setNotes]           = React.useState("");

  // Client info
  const [clientName, setClientName]       = React.useState("");
  const [clientPhone, setClientPhone]     = React.useState("");
  const [clientAddress, setClientAddress] = React.useState("");
  const [deposit, setDeposit]             = React.useState<string>("");
  const [discount, setDiscount]           = React.useState<string>("");
  const [discountType, setDiscountType]   = React.useState<"pct" | "egp">("pct");
  // Selling price mode: retail / wholesale / custom
  const [priceMode, setPriceMode]         = React.useState<"retail" | "wholesale" | "custom">("retail");
  const [customPrice, setCustomPrice]     = React.useState<string>("");

  // Dates
  const [startDate, setStartDate]       = React.useState(today());
  const [deliveryDate, setDeliveryDate] = React.useState("");

  // Fabric overrides: map of BOM fabricId → chosen fabricId
  const [fabricOverrides, setFabricOverrides] = React.useState<Record<string, string>>({});
  // Customer brings their own fabric — exclude fabric cost entirely
  const [customerOwnFabric, setCustomerOwnFabric] = React.useState(false);

  const selected = options.find((o) => o.id === productId);

  // When product changes, reset fabric overrides to defaults
  React.useEffect(() => {
    if (!selected) return;
    const defaults: Record<string, string> = {};
    for (const fl of selected.fabricLines) defaults[fl.fabricId] = fl.fabricId;
    setFabricOverrides(defaults);
  }, [productId, selected?.id]);

  // Reset on close
  React.useEffect(() => {
    if (!open) return;
    setProductId(defaultProductId ?? options[0]?.id ?? "");
    setQuantity(1);
    setStatus("IN_PROGRESS");
    setPriority("NORMAL");
    setNotes("");
    setClientName("");
    setClientPhone("");
    setClientAddress("");
    setDeposit("");
    setDiscount("");
    setDiscountType("pct");
    setPriceMode("retail");
    setCustomPrice("");
    setStartDate(today());
    setDeliveryDate("");
    setFabricOverrides({});
    setCustomerOwnFabric(false);
  }, [open, defaultProductId, options]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!productId) return;
    setSubmitting(true);
    try {
      // Build fabric override notes for the ticket
      const fabricNote = customerOwnFabric
        ? "Customer brings own fabric"
        : selected?.fabricLines
            .map((fl) => {
              const chosenId = fabricOverrides[fl.fabricId] ?? fl.fabricId;
              const chosen = availableFabrics.find((f) => f.id === chosenId);
              return chosen ? `${fl.meters.toFixed(1)}m ${chosen.name}` : null;
            })
            .filter(Boolean)
            .join(", ");

      await apiPost("/api/production-runs", {
        productId,
        quantity,
        status,
        priority,
        notes: [notes, fabricNote ? `Fabric: ${fabricNote}` : ""].filter(Boolean).join(" | ") || undefined,
        clientName: clientName || undefined,
        clientPhone: clientPhone || undefined,
        clientAddress: clientAddress || undefined,
        deposit: deposit ? parseFloat(deposit) : undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        unitCost: computedUnitCost,
        totalCost: runTotal,          // base price before discount
        discount: discountAmount > 0 ? discountAmount : undefined,
      });
      toast.success(`Order logged for ${selected?.name ?? "product"}`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log run");
    } finally {
      setSubmitting(false);
    }
  }

  // Live unit cost: nonFabricCost + each fabric line × chosen fabric's costPerMeter
  // If customerOwnFabric is true, fabric cost is excluded entirely.
  const computedUnitCost = React.useMemo(() => {
    if (!selected) return 0;
    if (customerOwnFabric) return selected.nonFabricCost;
    const fabricCost = selected.fabricLines.reduce((sum, fl) => {
      const chosenId = fabricOverrides[fl.fabricId] ?? fl.fabricId;
      const chosenFabric = availableFabrics.find((f) => f.id === chosenId);
      const cpm = chosenFabric?.costPerMeter ?? fl.defaultCostPerMeter;
      return sum + fl.meters * cpm;
    }, 0);
    return selected.nonFabricCost + fabricCost;
  }, [selected, fabricOverrides, availableFabrics, customerOwnFabric]);

  if (options.length === 0) {
    return (
      <Button variant={triggerVariant} disabled>
        <Factory className="h-4 w-4" /> No products yet
      </Button>
    );
  }

  // Selling price per unit based on chosen mode
  const baseUnitPrice = selected
    ? priceMode === "retail"    ? selected.retailPrice
    : priceMode === "wholesale" ? selected.wholesalePrice
    : parseFloat(customPrice) || 0
    : 0;

  const runTotal = baseUnitPrice * quantity;
  const discountNum = parseFloat(discount) || 0;
  const discountAmount = discountType === "pct"
    ? runTotal * (Math.min(discountNum, 100) / 100)
    : Math.min(discountNum, runTotal);
  const finalTotal = runTotal - discountAmount;
  const depositNum = parseFloat(deposit) || 0;
  const balance = finalTotal - depositNum;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <Factory className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>New production order</DialogTitle>
          <DialogDescription>
            Fill in product, client details and delivery date. Inventory will be adjusted separately once stock is configured.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">

          {/* ── Product + status + priority ── */}
          <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order details</p>
            <Field label="Product">
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}{" "}
                      <span className="text-muted-foreground">({o.sku})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <FieldGrid cols={3}>
              <Field label="Quantity">
                <Input
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
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
              <Field label="Priority">
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGrid>

            <FieldGrid cols={2}>
              <Field label="Start date">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field label="Delivery date">
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </Field>
            </FieldGrid>

            <Field label="Internal notes">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Fabric colour, special instructions…"
              />
            </Field>
          </div>

          {/* ── Fabric selection ── */}
          {selected && selected.fabricLines.length > 0 && (
            <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fabric selection</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Change fabric if the client chose a different one — price updates automatically.
                  </p>
                </div>
                {/* Customer brings own fabric toggle */}
                <button
                  type="button"
                  onClick={() => setCustomerOwnFabric((v) => !v)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    customerOwnFabric
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground/70"
                  }`}
                >
                  <PackageCheck className="h-3.5 w-3.5" />
                  Customer's fabric
                </button>
              </div>

              {customerOwnFabric ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <PackageCheck className="h-4 w-4 shrink-0" />
                  <span>Fabric cost excluded — customer provides their own fabric.</span>
                </div>
              ) : (
                selected.fabricLines.map((fl) => {
                  const chosenId = fabricOverrides[fl.fabricId] ?? fl.fabricId;
                  const chosenFabric = availableFabrics.find((f) => f.id === chosenId);
                  const cpm = chosenFabric?.costPerMeter ?? fl.defaultCostPerMeter;
                  const lineCost = fl.meters * cpm;
                  return (
                    <div key={fl.fabricId} className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{fl.meters.toFixed(1)} m</span>
                        of fabric · <span className="tabular-nums">{formatLE(lineCost)}</span>
                      </div>
                      <Select
                        value={chosenId}
                        onValueChange={(v) =>
                          setFabricOverrides((prev) => ({ ...prev, [fl.fabricId]: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFabrics.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              <span className="flex items-center justify-between gap-4 w-full">
                                <span>{f.name}</span>
                                <span className="text-muted-foreground tabular-nums text-xs">
                                  {formatLE(f.costPerMeter)}/m
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Client info ── */}
          <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client information</p>
            <FieldGrid cols={2}>
              <Field label="Client name">
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ahmed Hassan"
                />
              </Field>
              <Field label="Mobile number">
                <Input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+20 10 0000 0000"
                />
              </Field>
            </FieldGrid>
            <Field label="Delivery address">
              <Input
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="15 Tahrir Square, Cairo"
              />
            </Field>
          </div>

          {/* ── Pricing ── */}
          {selected && (
            <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing</p>
              <div className="space-y-3 text-sm">

                {/* Price mode selector */}
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { key: "retail",    label: "Retail",    value: selected.retailPrice },
                    { key: "wholesale", label: "Wholesale", value: selected.wholesalePrice },
                    { key: "custom",    label: "Custom",    value: null },
                  ] as const).map(({ key, label, value }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPriceMode(key)}
                      className={`flex flex-col items-center rounded-lg border px-3 py-2 text-xs transition-colors ${
                        priceMode === key
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:border-foreground/40"
                      }`}
                    >
                      <span className="font-semibold">{label}</span>
                      {value != null && value > 0 && (
                        <span className={`tabular-nums mt-0.5 ${priceMode === key ? "opacity-80" : "text-foreground/70"}`}>
                          {formatLE(value)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom price input */}
                {priceMode === "custom" && (
                  <Field label="Custom unit price (EGP)">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      autoFocus
                    />
                  </Field>
                )}

                {/* Customer's own fabric note */}
                {customerOwnFabric && selected.fabricLines.length > 0 && (
                  <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-400">
                    <span>Fabric — customer's own (excluded from cost)</span>
                    <span className="tabular-nums line-through text-muted-foreground/50">
                      {formatLE(selected.fabricLines.reduce((s, fl) => {
                        const cpm = availableFabrics.find(f => f.id === (fabricOverrides[fl.fabricId] ?? fl.fabricId))?.costPerMeter ?? fl.defaultCostPerMeter;
                        return s + fl.meters * cpm;
                      }, 0))}
                    </span>
                  </div>
                )}

                {/* Internal cost reference */}
                <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
                  <span>Internal cost (reference only)</span>
                  <span className="tabular-nums">{formatLE(computedUnitCost)}</span>
                </div>

                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Unit price × {quantity}</span>
                  <span className="tabular-nums">{formatLE(runTotal)}</span>
                </div>

                {/* Discount row */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Discount</span>
                  <div className="flex flex-1 items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      max={discountType === "pct" ? 100 : undefined}
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                    <div className="flex rounded-md border overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => setDiscountType("pct")}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                          discountType === "pct" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                        }`}
                      >%</button>
                      <button
                        type="button"
                        onClick={() => setDiscountType("egp")}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors border-l ${
                          discountType === "egp" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                        }`}
                      >EGP</button>
                    </div>
                  </div>
                  {discountAmount > 0 && (
                    <span className="shrink-0 text-sm tabular-nums text-rose-600 dark:text-rose-400">
                      −{formatLE(discountAmount)}
                    </span>
                  )}
                </div>

                {/* Final total */}
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Total</span>
                  <span className="font-display text-base font-bold tabular-nums">
                    {formatLE(finalTotal)}
                  </span>
                </div>

                {/* Deposit + balance */}
                <div className="flex items-end gap-2 border-t pt-2">
                  <Field label="Deposit received (EGP)" className="flex-1">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={deposit}
                      onChange={(e) => setDeposit(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <div className="pb-1 text-right">
                    <div className="text-xs text-muted-foreground">Balance due</div>
                    <div className={`tabular-nums font-semibold ${balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatLE(Math.max(0, balance))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !selected || quantity < 1}>
              {submitting ? "Saving…" : "Create order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
