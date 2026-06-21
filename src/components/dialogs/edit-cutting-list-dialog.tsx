"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Image as ImageIcon, Pencil } from "lucide-react";
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
import { Field, FieldGrid } from "@/components/forms/field";
import { ApiError } from "@/lib/api-client";

interface EditCuttingListDialogProps {
  cuttingList: {
    id: string;
    title: string | null;
    notes: string | null;
    fileName: string;
    fileType: string;
    fileSize: number;
    thumbnailPath: string | null;
  };
  triggerLabel?: string;
  /** Optional custom trigger; defaults to a "Edit" ghost button. */
  trigger?: React.ReactNode;
}

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Edit dialog for an existing cutting-list row. Lets you rename / re-note
 * the entry and optionally swap in a new file or cover image. Anything you
 * leave alone is kept untouched on the server.
 */
export function EditCuttingListDialog({
  cuttingList,
  triggerLabel = "Edit",
  trigger,
}: EditCuttingListDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [title, setTitle] = React.useState(cuttingList.title ?? "");
  const [notes, setNotes] = React.useState(cuttingList.notes ?? "");
  const [file, setFile] = React.useState<File | null>(null);
  const [thumbnail, setThumbnail] = React.useState<File | null>(null);
  // null = no change, true = drop existing cover
  const [dropCover, setDropCover] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const thumbInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(cuttingList.title ?? "");
    setNotes(cuttingList.notes ?? "");
    setFile(null);
    setThumbnail(null);
    setDropCover(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  }, [open, cuttingList]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (file && file.size > MAX_BYTES) {
      toast.error(`File is too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("notes", notes);
      if (file) fd.append("file", file);
      if (thumbnail) fd.append("thumbnail", thumbnail);
      else if (dropCover) fd.append("removeThumbnail", "1");

      const res = await fetch(`/api/cutting-lists/${cuttingList.id}`, {
        method: "PATCH",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(
          data.error ?? `Update failed (${res.status})`,
          res.status,
        );
      }
      toast.success("Cutting list updated");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="h-7 px-2">
            <Pencil className="h-3.5 w-3.5" /> {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit cutting list</DialogTitle>
          <DialogDescription>
            Rename, re-note, or replace the file. Leave the file/cover sections
            empty to keep the current ones.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGrid cols={2}>
            <Field label="Title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Front-cut diagram"
              />
            </Field>
            <Field label="Notes">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Use density 26 only"
              />
            </Field>
          </FieldGrid>

          {/* ── File replacement ── */}
          <Field
            label="Replace file (optional)"
            hint={`Current: ${cuttingList.fileName} · ${(cuttingList.fileSize / 1024 / 1024).toFixed(2)} MB`}
          >
            <label
              htmlFor="edit-cutting-list-file"
              className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/30 p-4 text-sm transition-colors hover:bg-secondary/50"
            >
              <FileUp className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                {file ? (
                  <>
                    <div className="truncate font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || "no MIME"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-medium">Pick a new file to replace it</div>
                    <div className="text-xs text-muted-foreground">
                      PDF, DWG, DXF, PNG, JPG, WEBP or GIF · up to 20 MB
                    </div>
                  </>
                )}
              </div>
              {file && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </label>
            <input
              ref={fileInputRef}
              id="edit-cutting-list-file"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,.dwg,.dxf,application/acad,image/vnd.dwg,application/dxf,image/vnd.dxf"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>

          {/* ── Cover image ── */}
          <Field
            label="Cover image"
            hint={cuttingList.thumbnailPath ? "A cover image is set. Upload to replace, or remove it." : "Optional — adds a thumbnail to the card."}
          >
            <label
              htmlFor="edit-cutting-list-thumb"
              className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/30 p-3 text-sm transition-colors hover:bg-secondary/50"
            >
              {thumbnail ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(thumbnail)}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{thumbnail.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(thumbnail.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setThumbnail(null);
                      if (thumbInputRef.current) thumbInputRef.current.value = "";
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </>
              ) : cuttingList.thumbnailPath && !dropCover ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cuttingList.thumbnailPath}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Current cover</div>
                    <div className="text-xs text-muted-foreground">
                      Pick an image to replace it
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setDropCover(true);
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {dropCover ? "Cover will be removed on save" : "Add a cover image"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      PNG / JPG / WEBP / GIF
                    </div>
                  </div>
                  {dropCover && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setDropCover(false);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Undo
                    </button>
                  )}
                </>
              )}
            </label>
            <input
              ref={thumbInputRef}
              id="edit-cutting-list-thumb"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                setThumbnail(e.target.files?.[0] ?? null);
                if (e.target.files?.[0]) setDropCover(false);
              }}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
