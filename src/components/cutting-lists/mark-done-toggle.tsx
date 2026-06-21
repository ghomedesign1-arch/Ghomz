"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";

interface MarkDoneToggleProps {
  cuttingListId: string;
  done: boolean;
}

export function MarkDoneToggle({ cuttingListId, done }: MarkDoneToggleProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    setPending(true);
    try {
      await apiPost(`/api/cutting-lists/${cuttingListId}/done`, { done: !done });
      toast.success(done ? "Marked as pending" : "Marked as done");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={done ? "default" : "outline"}
      onClick={toggle}
      disabled={pending}
      className="h-7 px-2 text-[11px]"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : done ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Circle className="h-3.5 w-3.5" />
      )}
      {done ? "Done" : "Mark done"}
    </Button>
  );
}
