"use client";

import * as React from "react";
import {
  PurchaseFormDialog,
  type PurchaseFormInitial,
  type PurchaseResources,
} from "@/components/dialogs/purchase-form-dialog";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { RowActionsMenu } from "./row-actions-menu";

interface PurchaseRowActionsProps {
  purchase: PurchaseFormInitial & { totalAmount: number };
  resources: PurchaseResources;
  canDelete?: boolean;
}

export function PurchaseRowActions({
  purchase,
  resources,
  canDelete,
}: PurchaseRowActionsProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <RowActionsMenu
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        canDelete={canDelete}
      />
      <PurchaseFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        resources={resources}
        initial={purchase}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        url={`/api/purchases/${purchase.id}`}
        title="Delete this purchase?"
        description={
          <span>
            This will remove the purchase record AND reverse its inventory
            effects (subtract every item it added back from stock).
            <br />
            <br />
            <span className="text-amber-700 dark:text-amber-300">
              If stock has already been consumed, the resource&apos;s stock
              may go below zero — adjust manually after deletion if needed.
            </span>
          </span>
        }
        confirmLabel="Delete purchase"
        successMessage="Purchase deleted · inventory reversed"
      />
    </>
  );
}
