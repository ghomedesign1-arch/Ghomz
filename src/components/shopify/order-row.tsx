"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Factory,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_LEAD_TIME_DAYS,
  DUE_SOON_WINDOW_DAYS,
  MAX_CALL_ATTEMPTS,
  effectiveDeliveryDate,
  type CallOutcome,
  type ShopifyOrderMeta,
  type ShopifyOrderPriority,
  type ShopifyOrderStatus,
  type ShopifyOrderSummary,
  type ShopifyPaymentMode,
} from "@/lib/shopify";

const STATUS_OPTS: { value: ShopifyOrderStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "IN_PRODUCTION", label: "In production" },
  { value: "READY", label: "Ready" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PRIORITY_OPTS: { value: ShopifyOrderPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "URGENT", label: "Urgent" },
];

const STATUS_TONE: Record<ShopifyOrderStatus, string> = {
  NEW: "bg-slate-100 text-slate-700 border-slate-200",
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-200",
  IN_PRODUCTION: "bg-amber-100 text-amber-800 border-amber-200",
  READY: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SHIPPED: "bg-emerald-600 text-white border-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
};

const PRIORITY_TONE: Record<ShopifyOrderPriority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  NORMAL: "bg-slate-200 text-slate-700",
  URGENT: "bg-rose-600 text-white",
};

export function ShopifyOrderRow({
  order,
  initialMeta,
  shopUrl,
  users,
}: {
  order: ShopifyOrderSummary;
  initialMeta: ShopifyOrderMeta;
  shopUrl: string;
  users: { id: string; name: string }[];
}) {
  const [meta, setMeta] = React.useState<ShopifyOrderMeta>(initialMeta);
  const [notesDraft, setNotesDraft] = React.useState(initialMeta.notes ?? "");
  const [showNotes, setShowNotes] = React.useState(
    Boolean(initialMeta.notes?.trim()),
  );
  const [saving, setSaving] = React.useState<string | null>(null);
  const [promoting, setPromoting] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const customerName = (order.customer
    ? [order.customer.first_name, order.customer.last_name]
        .filter(Boolean)
        .join(" ")
    : ""
  ).trim();
  const customerDisplay =
    customerName || order.customer?.email || "Walk-in / guest";
  const date = new Date(order.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const activeLineItems = order.line_items.filter(
    (li) => effectiveQty(li) > 0,
  );
  const totalItems = activeLineItems.reduce((a, i) => a + effectiveQty(i), 0);
  const currentTotal = currentAmount(order.current_total_price, order.total_price);
  const isTerminal = meta.status === "SHIPPED" || meta.status === "CANCELLED";
  const dueDate = effectiveDeliveryDate(order.created_at, meta);
  const daysToDue = Math.ceil(
    (dueDate.getTime() - Date.now()) / 86_400_000,
  );
  const isOverdue = !isTerminal && daysToDue < 0;
  const isDueSoon =
    !isTerminal && daysToDue >= 0 && daysToDue <= DUE_SOON_WINDOW_DAYS;
  const dueDateIso = dueDate.toISOString().slice(0, 10);

  async function save(patch: Partial<ShopifyOrderMeta>, key: string) {
    setSaving(key);
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Save failed");
        return;
      }
      const next: ShopifyOrderMeta = await res.json();
      setMeta(next);
    } finally {
      setSaving(null);
    }
  }

  async function callOp(
    body: { logCallAttempt?: CallOutcome; resetCallAttempts?: true },
    key: string,
  ) {
    setSaving(key);
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Save failed");
        return;
      }
      setMeta(payload);
    } finally {
      setSaving(null);
    }
  }

  async function promote() {
    setPromoting(true);
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promote: true }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Promote failed");
        return;
      }
      setMeta(payload);
      toast.success("Production run created");
    } finally {
      setPromoting(false);
    }
  }

  return (
    <Card
      className={
        meta.priority === "URGENT"
          ? "border-rose-300 shadow-rose-100"
          : isOverdue
            ? "border-amber-300"
            : undefined
      }
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
              <Link
                href={shopUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                {order.name}
                <ExternalLink className="h-3.5 w-3.5 opacity-50" />
              </Link>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[meta.status]}`}
              >
                {STATUS_OPTS.find((s) => s.value === meta.status)?.label}
              </span>
              {meta.priority === "URGENT" && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_TONE.URGENT}`}>
                  URGENT
                </span>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="text-[10px]">
                  Overdue by {Math.abs(daysToDue)}d
                </Badge>
              )}
              {isDueSoon && (
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  {daysToDue === 0
                    ? "Due today"
                    : `Due in ${daysToDue}d`}
                </span>
              )}
              {meta.productionLogId && (
                <Badge variant="success" className="gap-1 text-[10px]">
                  <Factory className="h-3 w-3" /> In production
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {customerDisplay} · Ordered {date}
              {order.customer?.phone && ` · ${order.customer.phone}`}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium ${
                  isOverdue
                    ? "border-rose-300 bg-rose-50 text-rose-800"
                    : isDueSoon
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-border bg-secondary/40 text-foreground"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Deliver by{" "}
                {dueDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {!meta.deliveryDate && (
                  <span className="text-[10px] opacity-70">(auto)</span>
                )}
              </span>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById(`due-date-${order.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Change
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-right">
              <div className="font-display text-lg font-semibold">
                {fmt(currentTotal)} {order.currency}
              </div>
              <div className="text-xs text-muted-foreground">
                {totalItems} item{totalItems === 1 ? "" : "s"}
              </div>
              <PaymentBadge order={order} meta={meta} />
            </div>
            <button
              type="button"
              onClick={() => setExpanded((s) => !s)}
              aria-label={expanded ? "Collapse details" : "Expand details"}
              className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-secondary"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {activeLineItems.map((li) => {
            const qty = effectiveQty(li);
            return (
              <div
                key={li.id}
                className="flex items-start justify-between gap-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{li.title}</div>
                  {li.variant_title && (
                    <div className="text-xs text-foreground/80">
                      {li.variant_title}
                    </div>
                  )}
                  {li.sku && (
                    <div className="text-[11px] text-muted-foreground">
                      SKU: {li.sku}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right text-sm">
                  <div>×{qty}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmt(li.price)} {order.currency}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {expanded && (
          <>
        <div className="grid gap-3 md:grid-cols-2">
          <PaymentBreakdown
            order={order}
            meta={meta}
            saving={saving}
            onSave={save}
            onCallOp={callOp}
          />
          <AddressBlock
            address={order.shipping_address ?? order.billing_address}
            fallbackPhone={order.customer?.phone ?? null}
          />
        </div>

        {order.note && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
            <div className="font-medium text-amber-900">Customer note</div>
            <div className="whitespace-pre-wrap text-amber-800">
              {order.note}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ErpField label="Status">
            <Select
              value={meta.status}
              onValueChange={(v) =>
                save({ status: v as ShopifyOrderStatus }, "status")
              }
              disabled={saving === "status"}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ErpField>

          <ErpField label="Priority">
            <Select
              value={meta.priority}
              onValueChange={(v) =>
                save({ priority: v as ShopifyOrderPriority }, "priority")
              }
              disabled={saving === "priority"}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ErpField>

          <ErpField label="Delivery date">
            <Input
              id={`due-date-${order.id}`}
              type="date"
              className="h-9"
              value={meta.deliveryDate ? meta.deliveryDate.slice(0, 10) : dueDateIso}
              onChange={(e) =>
                save(
                  { deliveryDate: e.target.value ? e.target.value : null },
                  "deliveryDate",
                )
              }
              disabled={saving === "deliveryDate"}
            />
            {!meta.deliveryDate && (
              <div className="text-[10px] text-muted-foreground">
                Auto (order date + {DEFAULT_LEAD_TIME_DAYS}d)
              </div>
            )}
          </ErpField>

          <ErpField label="Assigned to">
            <Select
              value={meta.assignedToId ?? "__none__"}
              onValueChange={(v) =>
                save(
                  { assignedToId: v === "__none__" ? null : v },
                  "assignedToId",
                )
              }
              disabled={saving === "assignedToId"}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ErpField>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowNotes((s) => !s)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {showNotes ? "Hide notes" : meta.notes ? "Edit notes" : "+ Add notes"}
          </button>
          <Button
            size="sm"
            onClick={promote}
            disabled={promoting || Boolean(meta.productionLogId)}
            variant={meta.productionLogId ? "outline" : "default"}
          >
            {promoting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Promoting…
              </>
            ) : meta.productionLogId ? (
              <>
                <Factory className="h-3.5 w-3.5" /> Already in production
              </>
            ) : (
              <>
                <Factory className="h-3.5 w-3.5" /> Promote to production
              </>
            )}
          </Button>
        </div>

        {showNotes && (
          <div>
            <Textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={() => {
                if (notesDraft !== (meta.notes ?? "")) {
                  save({ notes: notesDraft.trim() || null }, "notes");
                }
              }}
              placeholder="Internal notes — only visible in the ERP"
              className="text-sm"
            />
            {saving === "notes" && (
              <div className="mt-1 text-xs text-muted-foreground">Saving…</div>
            )}
          </div>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ErpField({
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

function effectiveQty(li: {
  quantity: number;
  current_quantity?: number | null;
}): number {
  // Shopify leaves refunded/removed line items in the payload with
  // `current_quantity` set to the still-active quantity (0 when removed).
  if (li.current_quantity != null) return Math.max(0, li.current_quantity);
  return Math.max(0, li.quantity ?? 0);
}

function currentAmount(
  current: string | number | null | undefined,
  original: string | number | null | undefined,
): number {
  const c = current == null || current === "" ? NaN : Number(current);
  if (Number.isFinite(c)) return c;
  const o = Number(original ?? 0);
  return Number.isFinite(o) ? o : 0;
}

function fmt(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-EG", { maximumFractionDigits: 2 });
}

function PaymentBadge({
  order,
  meta,
}: {
  order: ShopifyOrderSummary;
  meta: ShopifyOrderMeta;
}) {
  const { kind } = resolvePayment(order, meta);
  const label =
    kind === "paid"
      ? "Fully paid"
      : kind === "deposit"
        ? "Deposit"
        : kind === "refunded"
          ? "Refunded"
          : "Unpaid";
  const tone =
    kind === "paid"
      ? "bg-emerald-100 text-emerald-700"
      : kind === "deposit"
        ? "bg-amber-100 text-amber-800"
        : kind === "refunded"
          ? "bg-slate-200 text-slate-700"
          : "bg-rose-100 text-rose-700";
  return (
    <span
      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function resolvePayment(
  order: ShopifyOrderSummary,
  meta: ShopifyOrderMeta,
): { kind: "paid" | "deposit" | "unpaid" | "refunded"; paid: number; remaining: number } {
  const total = currentAmount(order.current_total_price, order.total_price);
  const status = (order.financial_status ?? "").toLowerCase();
  if (meta.paymentMode === "FULL") {
    return { kind: "paid", paid: total, remaining: 0 };
  }
  if (meta.paymentMode === "DEPOSIT") {
    const deposit = Math.max(0, Number(meta.depositAmount ?? 0));
    const remaining = Math.max(0, total - deposit);
    if (remaining <= 0.009) return { kind: "paid", paid: total, remaining: 0 };
    if (deposit > 0.009) return { kind: "deposit", paid: deposit, remaining };
    return { kind: "unpaid", paid: 0, remaining: total };
  }
  // AUTO — follow Shopify's financial state
  if (status === "refunded" || status === "voided") {
    const paid = Math.max(0, total - Number(order.total_outstanding ?? 0));
    return { kind: "refunded", paid, remaining: 0 };
  }
  const outstanding = Number(order.total_outstanding ?? 0);
  const paid = Math.max(0, total - outstanding);
  if (outstanding <= 0.009) return { kind: "paid", paid: total, remaining: 0 };
  if (paid > 0.009) return { kind: "deposit", paid, remaining: outstanding };
  return { kind: "unpaid", paid: 0, remaining: total };
}

function PaymentBreakdown({
  order,
  meta,
  saving,
  onSave,
  onCallOp,
}: {
  order: ShopifyOrderSummary;
  meta: ShopifyOrderMeta;
  saving: string | null;
  onSave: (patch: Partial<ShopifyOrderMeta>, key: string) => void;
  onCallOp: (
    body: { logCallAttempt?: CallOutcome; resetCallAttempts?: true },
    key: string,
  ) => void;
}) {
  const [depositDraft, setDepositDraft] = React.useState<string>(
    meta.depositAmount != null ? String(meta.depositAmount) : "",
  );
  React.useEffect(() => {
    setDepositDraft(meta.depositAmount != null ? String(meta.depositAmount) : "");
  }, [meta.depositAmount]);

  const total = currentAmount(order.current_total_price, order.total_price);
  const subtotal = currentAmount(order.current_subtotal_price, order.subtotal_price);
  const discount = currentAmount(order.current_total_discounts, order.total_discounts);
  const tax = currentAmount(order.current_total_tax, order.total_tax);
  const shipping = Math.max(0, total - subtotal - tax + discount);
  const { kind, paid, remaining } = resolvePayment(order, meta);

  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-3 text-xs">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Payment</span>
        <span>{order.currency}</span>
      </div>
      <div>
        <Row label="Subtotal" value={fmt(subtotal)} />
        {discount > 0 && <Row label="Discount" value={`− ${fmt(discount)}`} />}
        {shipping > 0 && <Row label="Shipping" value={fmt(shipping)} />}
        {tax > 0 && <Row label="Tax" value={fmt(tax)} />}
        <Row label="Total" value={fmt(total)} bold />
      </div>

      <div className="space-y-2 rounded-md border border-border bg-background p-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Payment mode
          </label>
          <Select
            value={meta.paymentMode}
            onValueChange={(v) =>
              onSave({ paymentMode: v as ShopifyPaymentMode }, "paymentMode")
            }
            disabled={saving === "paymentMode"}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AUTO">Auto (from Shopify)</SelectItem>
              <SelectItem value="FULL">Full payment</SelectItem>
              <SelectItem value="DEPOSIT">Deposit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {meta.paymentMode === "DEPOSIT" && (
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Deposit amount
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="h-8 text-xs"
              value={depositDraft}
              onChange={(e) => setDepositDraft(e.target.value)}
              onBlur={() => {
                const num = depositDraft === "" ? null : Number(depositDraft);
                if (num !== meta.depositAmount) {
                  onSave({ depositAmount: num }, "depositAmount");
                }
              }}
              disabled={saving === "depositAmount"}
              placeholder="0"
            />
          </div>
        )}
      </div>

      <div>
        {kind === "paid" ? (
          <Row label="Paid" value={fmt(paid)} tone="success" bold />
        ) : kind === "deposit" ? (
          <>
            <Row label="Deposit paid" value={fmt(paid)} tone="success" bold />
            <Row label="Remaining" value={fmt(remaining)} tone="warning" bold />
          </>
        ) : kind === "unpaid" ? (
          <Row label="Outstanding" value={fmt(remaining)} tone="danger" bold />
        ) : (
          <Row label="Refunded" value={fmt(paid)} tone="muted" />
        )}
      </div>

      {kind === "unpaid" && (
        <CallTracker
          meta={meta}
          saving={saving}
          onCallOp={onCallOp}
          onCancel={() => onSave({ status: "CANCELLED" }, "status")}
        />
      )}
    </div>
  );
}

function CallTracker({
  meta,
  saving,
  onCallOp,
  onCancel,
}: {
  meta: ShopifyOrderMeta;
  saving: string | null;
  onCallOp: (
    body: { logCallAttempt?: CallOutcome; resetCallAttempts?: true },
    key: string,
  ) => void;
  onCancel: () => void;
}) {
  const attempts = meta.callAttempts;
  const noAnswerCount = attempts.filter((a) => a.outcome === "no_answer").length;
  const outOfAttempts = attempts.length >= MAX_CALL_ATTEMPTS;
  const shouldCancel = noAnswerCount >= MAX_CALL_ATTEMPTS;

  return (
    <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50/60 p-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-900">
          Collection calls ({attempts.length}/{MAX_CALL_ATTEMPTS})
        </div>
        {attempts.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onCallOp({ resetCallAttempts: true }, "callReset")
            }
            disabled={saving === "callReset"}
            className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      <div className="space-y-1">
        {Array.from({ length: MAX_CALL_ATTEMPTS }).map((_, i) => {
          const a = attempts[i];
          if (!a) return null;
          const tone =
            a.outcome === "no_answer"
              ? "text-rose-700"
              : a.outcome === "answered"
                ? "text-slate-700"
                : "text-emerald-700";
          const label =
            a.outcome === "no_answer"
              ? "No answer"
              : a.outcome === "answered"
                ? "Answered"
                : "Promised to pay";
          return (
            <div
              key={i}
              className={`flex items-center justify-between text-[11px] ${tone}`}
            >
              <span>#{i + 1} · {label}</span>
              <span className="text-muted-foreground">
                {new Date(a.at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                {new Date(a.at).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
      </div>

      {!outOfAttempts && (
        <div className="flex flex-wrap gap-1 pt-1">
          <button
            type="button"
            onClick={() => onCallOp({ logCallAttempt: "no_answer" }, "callLog")}
            disabled={saving === "callLog"}
            className="rounded-md border border-rose-300 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            No answer
          </button>
          <button
            type="button"
            onClick={() => onCallOp({ logCallAttempt: "promised" }, "callLog")}
            disabled={saving === "callLog"}
            className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            Promised to pay
          </button>
          <button
            type="button"
            onClick={() => onCallOp({ logCallAttempt: "answered" }, "callLog")}
            disabled={saving === "callLog"}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Answered (other)
          </button>
        </div>
      )}

      {shouldCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={saving === "status"}
          className="w-full rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          3 no-answers — cancel this order
        </button>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "success" | "warning" | "danger" | "muted";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-800"
        : tone === "danger"
          ? "text-rose-700"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <div
      className={`flex items-center justify-between ${bold ? "font-semibold" : ""} ${toneCls}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function AddressBlock({
  address,
  fallbackPhone,
}: {
  address: ShopifyOrderSummary["shipping_address"] | null;
  fallbackPhone: string | null;
}) {
  if (!address) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        No shipping address on file
      </div>
    );
  }
  const lines = [
    address.name,
    address.company,
    address.address1,
    address.address2,
    [address.city, address.province, address.zip].filter(Boolean).join(" "),
    address.country,
  ].filter((s) => s && String(s).trim());
  const phone = address.phone ?? fallbackPhone;
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Shipping address
      </div>
      <div className="space-y-0.5">
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {phone && <div className="mt-1 text-muted-foreground">📞 {phone}</div>}
      </div>
    </div>
  );
}
