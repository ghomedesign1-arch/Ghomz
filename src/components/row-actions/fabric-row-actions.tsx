"use client";

import * as React from "react";
import {
  FabricFormDialog,
  type FabricFormValues,
} from "@/components/dialogs/fabric-form-dialog";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { RowActionsMenu } from "./row-actions-menu";

interface FabricRowActionsProps {
  fabric: {
    id: string;
    name: string;
    collection: string | null;
    color: string | null;
    texture: string | null;
    costPerMeter: number;
    stockMeters: number;
    reorderLevel: number;
    supplierId: string | null;
  };
  suppliers: { id: string; name: string }[];
  canDelete?: boolean;
}

export function FabricRowActions({
  fabric,
  suppliers,
  canDelete,
}: FabricRowActionsProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const initial: FabricFormValues = {
    id: fabric.id,
    name: fabric.name,
    collection: fabric.collection ?? "",
    color: fabric.color ?? "",
    texture: fabric.texture ?? "",
    costPerMeter: fabric.costPerMeter,
    stockMeters: fabric.stockMeters,
    reorderLevel: fabric.reorderLevel,
    supplierId: fabric.supplierId ?? "",
  };

  return (
    <>
      <RowActionsMenu
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        canDelete={canDelete}
      />
      <FabricFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        suppliers={suppliers}
        initial={initial}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        url={`/api/fabrics/${fabric.id}`}
        title={`Delete "${fabric.name}"?`}
        description="This permanently removes the fabric and unlinks it from any products that currently reference it."
        successMessage={`Deleted "${fabric.name}"`}
      />
    </>
  );
}
