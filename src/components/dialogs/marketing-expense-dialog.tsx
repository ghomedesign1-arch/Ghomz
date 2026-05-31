"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGrid } from "@/components/forms/field";
import { apiPost } from "@/lib/api-client";
import { formatLE } from "@/lib/costing";

const PLATFORMS = [
  { group: "Social Media", items: ["Facebook Ads", "Instagram Ads", "TikTok Ads", "Snapchat Ads", "Twitter / X Ads", "YouTube Ads", "LinkedIn Ads"] },
  { group: "Search & Display", items: ["Google Ads", "Google Display Network"] },
  { group: "Influencer & Content", items: ["Influencer / Creator", "Content Production", "Photography", "Video Production"] },
  { group: "Agency & Other", items: ["Marketing Agency", "PR Agency", "Print / Outdoor", "SMS / Email Campaign", "Other"] },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

interface MarketingExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExpenseRow {
  platform: string;
  campaign: string;
  amount: number;
}

function emptyRow(): ExpenseRow {
  return { platform: "Facebook Ads", campaign: "", amount: 0 };
}

export function MarketingExpenseDialog({ open, onOpenChange }: MarketingExpenseDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [date, setDate] = React.useState(today());
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [rows, setRows] = React.useState<ExpenseRow[]>([emptyRow()]);

  React.useEffect(() => {
    if (open) {
      setDate(today());
      setReference("");
      setNotes("");
      setRows([emptyRow()]);
    }
  }, [open]);

  const total = rows.reduce((a, r) => a + r.amount, 0);

  function updateRow(i: number, patch: Partial<ExpenseRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rows.some((r) => !r.campaign.trim())) {
      toast.error("Every expense needs a campaign / description");
      return;
    }
    if (total <= 0) {
      toast.error("Total amount must be greater than 0");
      return;
    }
    setSubmitting(true);
    try {
      await apiPost("/api/purchases", {
        reference: reference || undefined,
        notes: notes || undefined,
        purchaseDate: date ? new Date(date).toISOString() : undefined,
        items: rows.map((r) => ({
          kind: "MARKETING",
          itemName: r.platform,
          itemDescription: r.campaign.trim(),
          quantity: 1,
          unitCost: r.amount,
        })),
      });
      toast.success(`Recorded marketing expense · ${formatLE(total)}`);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Record marketing expense
          </DialogTitle>
          <DialogDescription>
            Log ad spend, agency fees, content production, or any other
            marketing cost. No supplier required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGrid cols={2}>
            <Field label="Date">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Reference / Invoice #">
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </FieldGrid>

          {/* Expense rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Expenses</p>
              <Button type="button" size="sm" variant="outline" onClick={addRow}>
                + Add line
              </Button>
            </div>

            {rows.map((row, i) => (
              <div key={i} className="rounded-xl border bg-secondary/30 p-4 space-y-3">
                <FieldGrid cols={2}>
                  <Field label="Platform / Channel">
                    <Select
                      value={row.platform}
                      onValueChange={(v) => updateRow(i, { platform: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((g) => (
                          <SelectGroup key={g.group}>
                            <SelectLabel>{g.group}</SelectLabel>
                            {g.items.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Amount (EGP)">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.amount || ""}
                      onChange={(e) => updateRow(i, { amount: Number(e.target.value) })}
                      placeholder="0.00"
                    />
                  </Field>
                </FieldGrid>
                <div className="flex items-end gap-2">
                  <Field label="Campaign / Description" className="flex-1">
                    <Input
                      required
                      value={row.campaign}
                      onChange={(e) => updateRow(i, { campaign: e.target.value })}
                      placeholder="e.g. Ramadan collection awareness, Retargeting Q2…"
                    />
                  </Field>
                  {rows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(i)}
                      className="mb-0.5 text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any extra context — budget period, account name, etc."
              rows={2}
            />
          </Field>

          {/* Total */}
          <div className="flex items-center justify-between rounded-xl border bg-secondary/40 px-5 py-4">
            <span className="text-sm text-muted-foreground">Total spend</span>
            <span className="font-display text-2xl font-semibold tabular-nums">
              {formatLE(total)}
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || total <= 0}>
              {submitting ? "Saving…" : "Record expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
