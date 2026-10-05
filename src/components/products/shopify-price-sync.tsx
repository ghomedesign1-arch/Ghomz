"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
interface Preview {
  erpName: string; shopifyName: string; variant: string; status: string;
  currency: string; oldPrice: string; newPrice: string; unchanged: boolean; approval: string;
}
export function ShopifyPriceSync({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const url = `/api/products/${productId}/shopify-price`;
  async function load() {
    setOpen(true); setBusy(true); setError(""); setSuccess(""); setPreview(null);
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load price preview.");
      setPreview(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load price preview."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!preview || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval: preview.approval }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Update could not be verified. Refresh the preview.");
      setSuccess(data.unchanged ? "Prices already match. No update was needed." : `Shopify confirmed the price: EGP ${data.price}.`);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update could not be verified. Refresh the preview.");
      setPreview(null);
    } finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" onClick={load} disabled={busy}>Sync price to Shopify</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Review Shopify price</DialogTitle>
          <DialogDescription>Review the saved ERP retail price before updating the linked Shopify variant.</DialogDescription>
        </DialogHeader>
        {busy && <p role="status">{preview ? "Updating price…" : "Checking prices…"}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {success && <p role="status">{success}</p>}
        {preview && <div className="space-y-4">
          <p className="font-medium">{preview.shopifyName} · {preview.variant}</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Current Shopify price</dt><dd>EGP {preview.oldPrice}</dd>
            <dt>Saved ERP retail price</dt><dd>EGP {preview.newPrice}</dd>
          </dl>
          {preview.status !== "ACTIVE" && <p className="rounded-md bg-muted p-3 text-sm">This Shopify product is {preview.status.toLowerCase()}. Updating its price will not publish it on the website.</p>}
          <p className="text-sm text-muted-foreground">Only this variant’s base retail price changes. Inventory, publication status, discounts and other products stay unchanged. Market-specific prices may differ.</p>
          {preview.unchanged ? <p>Prices already match. No update is needed.</p> :
            <Button onClick={confirm} disabled={busy}>Confirm price update</Button>}
        </div>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={busy}>Refresh preview</Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
