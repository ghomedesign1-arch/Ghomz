"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";

interface Props {
  cuttingListId: string;
  fileName: string;
}

export function DeleteCuttingListButton({ cuttingListId, fileName }: Props) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${fileName}`}
        className="h-8 w-8"
      >
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        url={`/api/cutting-lists/${cuttingListId}`}
        title={`Delete "${fileName}"?`}
        description="Removes the cutting list and its uploaded file from the server."
        successMessage="Cutting list removed"
      />
    </>
  );
}
