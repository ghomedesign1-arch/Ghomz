"use client";

import * as React from "react";
import {
  PocketCoilFormDialog,
  type PocketCoilFormValues,
} from "@/components/dialogs/pocket-coil-form-dialog";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { RowActionsMenu } from "./row-actions-menu";

interface PocketCoilRowActionsProps {
  coil: {
    id: string;
    name: string;
    costPerUnit: number;
    stockUnits: number;
    reorderLevel: number;
    supplierId: string | null;
    notes: string | null;
  };
  suppliers: { id: string; name: string }[];
  canDelete?: boolean;
}

export function PocketCoilRowActions({
  coil,
  suppliers,
  canDelete,
}: PocketCoilRowActionsProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const initial: PocketCoilFormValues = {
    id: coil.id,
    name: coil.name,
    costPerUnit: coil.costPerUnit,
    stockUnits: coil.stockUnits,
    reorderLevel: coil.reorderLevel,
    supplierId: coil.supplierId ?? "",
    notes: coil.notes ?? "",
  };

  return (
    <>
      <RowActionsMenu
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        canDelete={canDelete}
      />
      <PocketCoilFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        suppliers={suppliers}
        initial={initial}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        url={`/api/pocket-coils/${coil.id}`}
        title={`Delete "${coil.name}"?`}
        description="This removes the pocket coil and unlinks it from any products currently using it."
        successMessage={`Deleted "${coil.name}"`}
      />
    </>
  );
}
