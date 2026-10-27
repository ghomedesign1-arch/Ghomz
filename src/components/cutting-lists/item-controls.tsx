"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
}

function NameDialog({
  trigger,
  title,
  initial,
  submitLabel,
  onSubmit,
}: {
  trigger: React.ReactNode;
  title: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(name.trim());
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Cutting-list items are separate from Products.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Honey Hug 120"
            autoFocus
            required
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddCuttingItemButton() {
  const router = useRouter();
  return (
    <NameDialog
      title="Add cutting-list item"
      initial=""
      submitLabel="Add"
      trigger={
        <Button variant="outline">
          <Plus className="h-4 w-4" /> Add item
        </Button>
      }
      onSubmit={async (name) => {
        await send("/api/cutting-lists/items", "POST", { name });
        toast.success(`${name} added`);
        router.refresh();
      }}
    />
  );
}

export function CuttingItemActions({
  itemId,
  name,
  fileCount,
}: {
  itemId: string;
  name: string;
  fileCount: number;
}) {
  const router = useRouter();

  async function remove() {
    const msg =
      fileCount > 0
        ? `Delete "${name}" and its ${fileCount} file${fileCount === 1 ? "" : "s"}? This can't be undone.`
        : `Delete "${name}"?`;
    if (!confirm(msg)) return;
    try {
      await send(`/api/cutting-lists/items/${itemId}`, "DELETE");
      toast.success(`${name} deleted`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="flex items-center gap-1">
      <NameDialog
        title="Rename item"
        initial={name}
        submitLabel="Save"
        trigger={
          <Button variant="ghost" size="sm" title="Rename">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        }
        onSubmit={async (next) => {
          await send(`/api/cutting-lists/items/${itemId}`, "PATCH", { name: next });
          toast.success("Renamed");
          router.refresh();
        }}
      />
      <Button variant="ghost" size="sm" title="Delete" onClick={remove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
