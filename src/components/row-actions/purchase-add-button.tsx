"use client";

import * as React from "react";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PurchaseFormDialog,
  type PurchaseResources,
} from "@/components/dialogs/purchase-form-dialog";

type Kind = "SPONGE" | "FABRIC" | "BULK" | "MARKETING" | "OTHER";

interface AddPurchaseButtonProps {
  resources: PurchaseResources;
  /** Pre-pick the Kind on the first item row. */
  defaultKind?: Kind;
  /** Force every line in this purchase to the defaultKind (hides the Kind
   *  dropdown). Pair with defaultKind when opening from a kind-specific
   *  section so users can't mix kinds in one purchase. */
  lockKind?: boolean;
  /** Override the trigger label. Falls back to "Record purchase". */
  label?: string;
}

export function AddPurchaseButton({
  resources,
  defaultKind,
  lockKind,
  label,
}: AddPurchaseButtonProps) {
  const [open, setOpen] = React.useState(false);
  const noSuppliers = resources.suppliers.length === 0;
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={noSuppliers}>
        <Truck className="h-4 w-4" />{" "}
        {noSuppliers ? "Add a supplier first" : (label ?? "Record purchase")}
      </Button>
      <PurchaseFormDialog
        open={open}
        onOpenChange={setOpen}
        resources={resources}
        defaultKind={defaultKind}
        lockKind={lockKind}
      />
    </>
  );
}
