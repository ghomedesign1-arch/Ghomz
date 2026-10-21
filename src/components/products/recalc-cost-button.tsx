"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Force-recomputes this product's BOM-derived unit cost and refreshes the
 * cached value stored on the product row. Only needed when the catalog
 * shows an obviously stale number — day-to-day the cache is invalidated
 * automatically by BOM / material / sponge edits.
 */
export function RecalcCostButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${productId}/recalc`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Recalculate failed");
        return;
      }
      toast.success("Cost recalculated");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={run} disabled={busy}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      Recalculate
    </Button>
  );
}
