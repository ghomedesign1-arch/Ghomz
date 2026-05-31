"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiDelete } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string; // DELETE endpoint, e.g. /api/sponges/abc123
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  successMessage?: string;
  /** Where to go after a successful delete. Default: refresh in place. */
  redirectTo?: string;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  url,
  title,
  description,
  confirmLabel = "Delete",
  successMessage,
  redirectTo,
}: ConfirmDeleteDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  async function onConfirm(event: React.MouseEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiDelete(url);
      toast.success(successMessage ?? "Deleted");
      onOpenChange(false);
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={submitting}
            className={cn(
              "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
