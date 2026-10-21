"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Flame, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * One-shot "fill the catalog cost cache" action. Repeatedly POSTs small
 * batches to the warm-cache endpoint until nothing is left uncached, so
 * no single request exceeds Vercel's serverless timeout even on a cold
 * Neon connection. Reports progress via toast.
 */
export function WarmCacheButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    const toastId = toast.loading("Warming catalog cache…");
    try {
      let totalProcessed = 0;
      let safety = 50; // generous guard against runaway loops
      while (safety-- > 0) {
        const res = await fetch("/api/products/warm-cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 20 }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          processed?: number;
          remaining?: number;
          errors?: { id: string; message: string }[];
          error?: string;
        };
        if (!res.ok) {
          toast.error(data.error ?? "Warm cache failed", { id: toastId });
          return;
        }
        totalProcessed += data.processed ?? 0;
        toast.loading(
          `Warming… ${totalProcessed} done, ${data.remaining ?? 0} to go`,
          { id: toastId },
        );
        if ((data.remaining ?? 0) <= 0) break;
        if ((data.processed ?? 0) === 0) {
          // Nothing moved — probably every remaining product errored.
          toast.error(
            `Stuck with ${data.remaining} products uncached. Check logs.`,
            { id: toastId },
          );
          return;
        }
      }
      toast.success(`Cache warmed · ${totalProcessed} products`, {
        id: toastId,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={run}
      disabled={busy}
      title="Pre-compute every product's unit cost so the catalog list is instant."
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Flame className="h-4 w-4" />
      )}
      Warm cache
    </Button>
  );
}
