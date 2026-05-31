"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { RowActionsMenu } from "./row-actions-menu";

interface ProductRowActionsProps {
  product: { id: string; name: string };
  canDelete?: boolean;
  /** Where to navigate after a successful delete. Default: stay in place
   *  and refresh (suitable for list pages). */
  redirectTo?: string;
}

export function ProductRowActions({
  product,
  canDelete,
  redirectTo,
}: ProductRowActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <RowActionsMenu
        onEdit={() => router.push(`/products/${product.id}/edit`)}
        onDelete={() => setDeleteOpen(true)}
        canDelete={canDelete}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        url={`/api/products/${product.id}`}
        title={`Delete "${product.name}"?`}
        description="This permanently removes the product, its bill of materials (sponge cuts, fabric, fiber, packaging, manufacturing lines), AND every production run on its ledger. This cannot be undone."
        successMessage={`Deleted "${product.name}"`}
        redirectTo={redirectTo}
      />
    </>
  );
}
