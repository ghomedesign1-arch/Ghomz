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
import { apiPatch } from "@/lib/api-client";
import { formatLE } from "@/lib/costing";
import type { FabricLine, AvailableFabric } from "./production-run-dialog";

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

export interface EditProductionRunValues {
  id: string;
  productName: string;
  unitCost: number;
  retailPrice: number;
  wholesalePrice: number;
  totalCost: number;
  discount: number;
  quantity: number;
  status: string;
  priority: string;
  notes: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  deposit: number | null;
  startedAt: Date;
  deliveryDate: Date | null;
  /** Fabric lines from the product BOM — used for fabric selection */
  fabricLines: FabricLine[];
  /** All fabrics available in inventory */
  availableFabrics: AvailableFabric[];
  /** BOM cost excluding all fabric — used to recompute cost live when fabric changes */
  nonFabricCost: number;
}

interface EditProductionRunDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  run: EditProductionRunValues;
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Split "user notes | Fabric: 4.0m Spaniol Reaf" into its two parts */
function splitNotes(raw: string | null): { userNotes: string; fabricPart: string } {
  if (!raw) return { userNotes: "", fabricPart: "" };
  const idx = raw.indexOf(" | Fabric:");
  if (idx !== -1) return { userNotes: raw.slice(0, idx), fabricPart: raw.slice(idx + " | Fabric:".length).trim() };
  if (raw.startsWith("Fabric:")) return { userNotes: "", fabricPart: raw.slice("Fabric:".length).trim() };
  return { userNotes: raw, fabricPart: "" };
}

/** Try to infer fabric overrides from the fabric note string */
function parseFabricOverrides(
  fabricPart: string,
  fabricLines: FabricLine[] | undefined,
  availableFabrics: AvailableFabric[] | undefined,
): { customerOwnFabric: boolean; overrides: Record<string, string> } {
  if (fabricPart === "Customer brings own fabric") {
    return { customerOwnFabric: true, overrides: {} };
  }
  const overrides: Record<string, string> = {};
  for (const fl of fabricLines ?? []) {
    const match = (availableFabrics ?? []).find(
      (af) => fabricPart.toLowerCase().includes(af.name.toLowerCase()),
    );
    overrides[fl.fabricId] = match?.id ?? fl.fabricId;
  }
  return { customerOwnFabric: false, overrides };
}

/** Build the fabric portion of the notes string */
function buildFabricNote(
  customerOwnFabric: boolean,
  fabricLines: FabricLine[],
  overrides: Record<string, string>,
  availableFabrics: AvailableFabric[],
): string {
  if (!fabricLines.length) return "";
  if (customerOwnFabric) return "Customer brings own fabric";
  return fabricLines
    .map((fl) => {
      const chosenId = overrides[fl.fabricId] ?? fl.fabricId;
      const chosen = availableFabrics.find((f) => f.id === chosenId);
      return `${fl.meters}m ${chosen?.name ?? fl.fabricName}`;
    })
    .join(", ");
}

function toDateInput(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

/** Guess which price mode was used when the order was originally created */
function guessPriceMode(
  totalCost: number,
  quantity: number,
  retailPrice: number,
  wholesalePrice: number,
): { mode: "retail" | "wholesale" | "custom"; customPrice: string } {
  if (quantity <= 0) return { mode: "retail", customPrice: "" };
  const perUnit = totalCost / quantity;
  if (Math.abs(perUnit - retailPrice) < 0.01)    return { mode: "retail",    customPrice: "" };
  if (Math.abs(perUnit - wholesalePrice) < 0.01) return { mode: "wholesale", customPrice: "" };
  return { mode: "custom", customPrice: perUnit > 0 ? String(perUnit) : "" };
}

export function EditProductionRunDialog({
  open,
  onOpenChange,
  run,
}: EditProductionRunDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  // Order fields
  const [quantity, setQuantity]           = React.useState(run.quantity);
  const [status, setStatus]               = React.useState(run.status);
  const [priority, setPriority]           = React.useState(run.priority);
  const [startDate, setStartDate]         = React.useState(toDateInput(run.startedAt));
  const [deliveryDate, setDeliveryDate]   = React.useState(toDateInput(run.deliveryDate));

  // Notes split: user-visible notes vs fabric annotation
  const initSplit = splitNotes(run.notes);
  const [userNotes, setUserNotes]         = React.useState(initSplit.userNotes);

  // Client fields
  const [clientName, setClientName]       = React.useState(run.clientName ?? "");
  const [clientPhone, setClientPhone]     = React.useState(run.clientPhone ?? "");
  const [clientAddress, setClientAddress] = React.useState(run.clientAddress ?? "");

  // Fabric selection
  const initFabric = parseFabricOverrides(initSplit.fabricPart, run.fabricLines, run.availableFabrics);
  const [customerOwnFabric, setCustomerOwnFabric] = React.useState(initFabric.customerOwnFabric);
  const [fabricOverrides, setFabricOverrides]     = React.useState<Record<string, string>>(initFabric.overrides);

  // Pricing
  const guessed = guessPriceMode(run.totalCost, run.quantity, run.retailPrice, run.wholesalePrice);
  const [priceMode, setPriceMode]         = React.useState<"retail" | "wholesale" | "custom">(guessed.mode);
  const [customPrice, setCustomPrice]     = React.useState(guessed.customPrice);
  const [discount, setDiscount]           = React.useState<string>(run.discount > 0 ? String(run.discount) : "");
  const [discountType, setDiscountType]   = React.useState<"pct" | "egp">("egp");
  const [deposit, setDeposit]             = React.useState(run.deposit != null ? String(run.deposit) : "");

  // Sync when dialog re-opens with different run
  React.useEffect(() => {
    if (!open) return;
    setQuantity(run.quantity);
    setStatus(run.status);
    setPriority(run.priority);
    const sp = splitNotes(run.notes);
    setUserNotes(sp.userNotes);
    setStartDate(toDateInput(run.startedAt));
    setDeliveryDate(toDateInput(run.deliveryDate));
    setClientName(run.clientName ?? "");
    setClientPhone(run.clientPhone ?? "");
    setClientAddress(run.clientAddress ?? "");
    setDeposit(run.deposit != null ? String(run.deposit) : "");
    setDiscount(run.discount > 0 ? String(run.discount) : "");
    setDiscountType("egp");
    const g = guessPriceMode(run.totalCost, run.quantity, run.retailPrice, run.wholesalePrice);
    setPriceMode(g.mode);
    setCustomPrice(g.customPrice);
    const fp = parseFabricOverrides(sp.fabricPart, run.fabricLines, run.availableFabrics);
    setCustomerOwnFabric(fp.customerOwnFabric);
    setFabricOverrides(fp.overrides);
  }, [open, run]);

  // Live internal cost — recalculates when fabric changes
  const dynamicUnitCost = React.useMemo(() => {
    if (customerOwnFabric) return run.nonFabricCost;
    const fabricCost = run.fabricLines.reduce((sum, fl) => {
      const chosenId = fabricOverrides[fl.fabricId] ?? fl.fabricId;
      const chosen = run.availableFabrics.find((f) => f.id === chosenId);
      return sum + (chosen?.costPerMeter ?? fl.defaultCostPerMeter) * fl.meters;
    }, 0);
    return run.nonFabricCost + fabricCost;
  }, [customerOwnFabric, fabricOverrides, run]);

  // Live price calculations
  const baseUnitPrice =
    priceMode === "retail"    ? run.retailPrice
    : priceMode === "wholesale" ? run.wholesalePrice
    : parseFloat(customPrice) || 0;

  const runTotal       = baseUnitPrice * quantity;
  const discountNum    = parseFloat(discount) || 0;
  const discountAmount = discountType === "pct"
    ? runTotal * (Math.min(discountNum, 100) / 100)
    : Math.min(discountNum, runTotal);
  const finalTotal  = runTotal - discountAmount;
  const depositNum  = parseFloat(deposit) || 0;
  const balance     = finalTotal - depositNum;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Rebuild notes = userNotes + fabric annotation
      const fabricNote = buildFabricNote(customerOwnFabric, run.fabricLines, fabricOverrides, run.availableFabrics);
      const combinedNotes = [userNotes.trim(), fabricNote ? `Fabric: ${fabricNote}` : ""].filter(Boolean).join(" | ") || null;

      await apiPatch(`/api/production-runs/${run.id}`, {
        quantity,
        status,
        priority,
        notes:         combinedNotes,
        clientName:    clientName.trim()    || null,
        clientPhone:   clientPhone.trim()   || null,
        clientAddress: clientAddress.trim() || null,
        deposit:       deposit !== "" ? parseFloat(deposit) : null,
        startDate:     startDate    ? new Date(startDate).toISOString()    : null,
        deliveryDate:  deliveryDate ? new Date(deliveryDate).toISOString() : null,
        totalCost:     runTotal,          // base price before discount
        // Persist the per-unit cost the user actually picked (reflects any
        // fabric override / "customer brings own fabric" toggle).
        unitCost:      dynamicUnitCost,
        discount:      discountAmount,    // always send (0 = no discount)
      });
      toast.success("Order updated");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>Edit order — {run.productName}</DialogTitle>
          <DialogDescription>
            Update status, client details, delivery date or pricing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">

          {/* ── Order details ── */}
          <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order details</p>
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
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Delivery date">
                <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </Field>
            </FieldGrid>

            <Field label="Internal notes">
              <Input
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Special instructions, colour notes…"
              />
            </Field>
          </div>

          {/* ── Fabric selection ── */}
          {run.fabricLines.length > 0 && (
            <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fabric</p>

              {/* Customer's own fabric toggle */}
              <button
                type="button"
                onClick={() => setCustomerOwnFabric((v) => !v)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                  customerOwnFabric
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
              >
                <span className="font-medium">Customer brings own fabric</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${customerOwnFabric ? "bg-background/20" : "bg-muted"}`}>
                  {customerOwnFabric ? "ON" : "OFF"}
                </span>
              </button>

              {/* Per-fabric dropdowns */}
              {!customerOwnFabric && run.fabricLines.map((fl) => (
                <Field key={fl.fabricId} label={`${fl.meters}m — ${fl.fabricName} (default)`}>
                  <Select
                    value={fabricOverrides[fl.fabricId] ?? fl.fabricId}
                    onValueChange={(v) => setFabricOverrides((prev) => ({ ...prev, [fl.fabricId]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {run.availableFabrics.map((af) => (
                        <SelectItem key={af.id} value={af.id}>
                          {af.name}
                          <span className="ml-2 text-muted-foreground text-xs">
                            {formatLE(af.costPerMeter)}/m
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
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
          <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing</p>
            <div className="space-y-3 text-sm">

              {/* Price mode selector */}
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { key: "retail",    label: "Retail",    value: run.retailPrice },
                  { key: "wholesale", label: "Wholesale", value: run.wholesalePrice },
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

              {/* Internal cost reference */}
              <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
                <span>Internal cost (reference only)</span>
                <span className="tabular-nums">
                  {formatLE(dynamicUnitCost)}
                  {dynamicUnitCost !== run.unitCost && (
                    <span className={`ml-1.5 text-[10px] ${dynamicUnitCost > run.unitCost ? "text-rose-500" : "text-emerald-600"}`}>
                      ({dynamicUnitCost > run.unitCost ? "+" : ""}{formatLE(dynamicUnitCost - run.unitCost)})
                    </span>
                  )}
                </span>
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

              {/* Profit summary */}
              {(() => {
                const orderProfit = finalTotal - dynamicUnitCost * quantity;
                const orderMargin = finalTotal > 0 ? (orderProfit / finalTotal) * 100 : 0;
                const profitColor = orderProfit <= 0 ? "#dc2626"
                  : orderMargin >= 25 ? "#16a34a"
                  : orderMargin >= 20 ? "#d97706"
                  : "#dc2626";
                return (
                  <div className="flex justify-between rounded-lg px-3 py-2" style={{ background: profitColor + "18" }}>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: profitColor }}>
                        Order profit
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        BOM cost {formatLE(dynamicUnitCost * quantity)} × {quantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold tabular-nums" style={{ color: profitColor }}>
                        {formatLE(orderProfit)}
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {orderMargin.toFixed(1)}% margin
                      </div>
                    </div>
                  </div>
                );
              })()}

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

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
