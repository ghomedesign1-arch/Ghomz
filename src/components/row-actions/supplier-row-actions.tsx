"use client";

import * as React from "react";
import {
  SupplierFormDialog,
  type SupplierFormValues,
} from "@/components/dialogs/supplier-form-dialog";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { RowActionsMenu } from "./row-actions-menu";

interface SupplierRowActionsProps {
  supplier: {
    id: string;
    name: string;
    contact: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
  };
  canDelete?: boolean;
}

export function SupplierRowActions({
  supplier,
  canDelete,
}: SupplierRowActionsProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const initial: SupplierFormValues = {
    id: supplier.id,
    name: supplier.name,
    contact: supplier.contact ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    address: supplier.address ?? "",
    notes: supplier.notes ?? "",
  };

  return (
    <>
      <RowActionsMenu
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        canDelete={canDelete}
      />
      <SupplierFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={initial}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        url={`/api/suppliers/${supplier.id}`}
        title={`Delete "${supplier.name}"?`}
        description="This permanently removes the supplier. Sponges and fabrics that reference it will be unlinked."
        successMessage={`Deleted "${supplier.name}"`}
      />
    </>
  );
}
