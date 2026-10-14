"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WorkOrderActions({
  text,
  hasRows,
}: {
  text: string;
  hasRows: boolean;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Work order copied — paste into WhatsApp or email");
    } catch {
      toast.error("Copy failed — your browser blocked clipboard access");
    }
  }

  function sendWhatsApp() {
    // Open WhatsApp without a specific recipient so you can pick the
    // factory contact from your chat list.
    const link = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(link, "_blank", "noopener,noreferrer");
  }

  function print() {
    window.print();
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
        disabled={!hasRows}
      >
        <Copy className="h-3.5 w-3.5" />
        Copy
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={sendWhatsApp}
        disabled={!hasRows}
        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={print}
        disabled={!hasRows}
      >
        <Printer className="h-3.5 w-3.5" />
        Print / PDF
      </Button>
    </div>
  );
}
