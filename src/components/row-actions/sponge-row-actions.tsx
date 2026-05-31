"use client";

import * as React from "react";
import {
  SpongeFormDialog,
  type SpongeFormValues,
  type ProductForYield,
  type YieldRow,
} from "@/components/dialogs/sponge-form-dialog";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { RowActionsMenu } from "./row-actions-menu";

interface SpongeRowActionsProps {
  sponge: {
    id: string;
    name: string;
    color: string;
    hardness: string;
    density: number;
    widthCm: number;
    depthCm: number;
    heightCm: number;
    pricePerDensity: number;
    stockBlocks: number;
    wastePct: number;
    supplierId: string | null;
    manufactureDate: Date | string | null;
    notes: string | null;
  };
  suppliers: { id: string; name: string }[];
  /** Products eligible to appear in this sponge's cutting plan. */
  products?: ProductForYield[];
  /** Existing cutting-plan rows for this sponge. */
  initialYields?: YieldRow[];
  canDelete?: boolean;
}

export function SpongeRowActions({
  sponge,
  suppliers,
  products,
  initialYields,
  canDelete,
}: SpongeRowActionsProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const initial: SpongeFormValues = {
    id: sponge.id,
    name: sponge.name,
    color: sponge.color,
    hardness: sponge.hardness,
    density: sponge.density,
    widthCm: sponge.widthCm,
    depthCm: sponge.depthCm,
    heightCm: sponge.heightCm,
    pricePerDensity: sponge.pricePerDensity,
    stockBlocks: sponge.stockBlocks,
    wastePct: sponge.wastePct,
    supplierId: sponge.supplierId ?? "",
    manufactureDate: sponge.manufactureDate
      ? new Date(sponge.manufactureDate).toISOString().slice(0, 10)
      : "",
    notes: sponge.notes ?? "",
  };

  return (
    <>
      <RowActionsMenu
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        canDelete={canDelete}
      />
      <SpongeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        suppliers={suppliers}
        initial={initial}
        products={products}
        initialYields={initialYields}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        url={`/api/sponges/${sponge.id}`}
        title={`Delete "${sponge.name}"?`}
        description="This permanently removes the sponge block and unlinks it from any products that currently reference it."
        successMessage={`Deleted "${sponge.name}"`}
      />
    </>
  );
}
