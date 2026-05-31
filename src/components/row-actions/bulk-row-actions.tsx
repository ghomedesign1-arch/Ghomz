"use client";

import * as React from "react";
import {
  BulkFormDialog,
  type BulkFormValues,
} from "@/components/dialogs/bulk-form-dialog";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { RowActionsMenu } from "./row-actions-menu";

interface BulkRowActionsProps {
  bulk: {
    id: string;
    name: string;
    kind: string;
    costPerKg: number;
    stockKg: number;
    reorderLevel: number;
  };
  canDelete?: boolean;
}

export function BulkRowActions({ bulk, canDelete }: BulkRowActionsProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const initial: BulkFormValues = {
    id: bulk.id,
    name: bulk.name,
    kind: bulk.kind,
    costPerKg: bulk.costPerKg,
    stockKg: bulk.stockKg,
    reorderLevel: bulk.reorderLevel,
  };

  return (
    <>
      <RowActionsMenu
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        canDelete={canDelete}
      />
      <BulkFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={initial}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        url={`/api/materials/${bulk.id}`}
        title={`Delete "${bulk.name}"?`}
        description="This permanently removes the bulk material and unlinks it from any products that currently reference it."
        successMessage={`Deleted "${bulk.name}"`}
      />
    </>
  );
}
