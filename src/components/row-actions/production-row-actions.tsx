"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import {
  EditProductionRunDialog,
  type EditProductionRunValues,
} from "@/components/dialogs/edit-production-run-dialog";

interface ProductionRowActionsProps {
  run: EditProductionRunValues;
  // fabricLines + availableFabrics are part of EditProductionRunValues
}

export function ProductionRowActions({ run }: ProductionRowActionsProps) {
  const [editOpen, setEditOpen]     = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Row actions"
            className="h-8 w-8"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit order
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete run
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProductionRunDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        run={run}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        url={`/api/production-runs/${run.id}`}
        title="Delete this run?"
        description={
          <span>
            Removes the production log for{" "}
            <strong>
              {run.quantity}× {run.productName}
            </strong>{" "}
            on{" "}
            {run.startedAt.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}{" "}
            and all of its consumption records.
            <br />
            <br />
            <span className="text-amber-700 dark:text-amber-300">
              Note: this does <em>not</em> restore the inventory the run
              consumed, and finished-product stock is left untouched.
            </span>
          </span>
        }
        confirmLabel="Delete run"
        successMessage="Production run deleted"
      />
    </>
  );
}
