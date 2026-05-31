"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Image as ImageIcon, Upload } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGrid } from "@/components/forms/field";
import { ApiError } from "@/lib/api-client";

interface UploadCuttingListDialogProps {
  /** Products you can attach a cutting list to. */
  products: { id: string; name: string; sku: string }[];
  /** Pre-select this product (e.g. when triggered from a product detail). */
  defaultProductId?: string;
  /** Customize the trigger label. */
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
}

const MAX_BYTES = 10 * 1024 * 1024;

export function UploadCuttingListDialog({
  products,
  defaultProductId,
  triggerLabel = "Upload cutting list",
  triggerVariant = "default",
}: UploadCuttingListDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [productId, setProductId] = React.useState(
    defaultProductId ?? products[0]?.id ?? "",
  );
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [thumbnail, setThumbnail] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const thumbInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setProductId(defaultProductId ?? products[0]?.id ?? "");
      setTitle("");
      setNotes("");
      setFile(null);
      setThumbnail(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    }
  }, [open, defaultProductId, products]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      toast.error("Pick a PDF, image, or DWG/DXF file first");
      return;
    }
    if (!productId) {
      toast.error("Pick a product");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`File is too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("productId", productId);
      if (title) fd.append("title", title);
      if (notes) fd.append("notes", notes);
      if (thumbnail) fd.append("thumbnail", thumbnail);

      const res = await fetch("/api/cutting-lists", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(
          data.error ?? `Upload failed (${res.status})`,
          res.status,
        );
      }
      toast.success("Cutting list uploaded");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  const noProducts = products.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} disabled={noProducts}>
          <Upload className="h-4 w-4" />{" "}
          {noProducts ? "Create a product first" : triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload cutting list</DialogTitle>
          <DialogDescription>
            Attach a PDF, image, or AutoCAD <strong>DWG / DXF</strong> file the
            factory uses to cut sponge for this product. Max 10 MB.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Product">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a product…" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({p.sku})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FieldGrid cols={2}>
            <Field label="Title (optional)">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Front-cut diagram"
              />
            </Field>
            <Field label="Notes (optional)">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Use density 26 only"
              />
            </Field>
          </FieldGrid>

          <Field
            label="File"
            hint="PDF, DWG, DXF, PNG, JPG, WEBP or GIF · up to 10 MB"
          >
            <label
              htmlFor="cutting-list-file"
              className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/30 p-4 text-sm transition-colors hover:bg-secondary/50"
            >
              <FileUp className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                {file ? (
                  <>
                    <div className="truncate font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-medium">Click to choose a file</div>
                    <div className="text-xs text-muted-foreground">
                      or drag and drop onto this area
                    </div>
                  </>
                )}
              </div>
            </label>
            <input
              ref={fileInputRef}
              id="cutting-list-file"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,.dwg,.dxf,application/acad,image/vnd.dwg,application/dxf,image/vnd.dxf"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>

          {/* Cover image — useful when the main file is a PDF so the card shows
              a real preview instead of the generic icon. */}
          <Field
            label="Cover image (optional)"
            hint="A photo or render shown as the card thumbnail. PNG / JPG / WEBP / GIF."
          >
            <label
              htmlFor="cutting-list-thumb"
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
                    <div className="truncate font-medium">
                      {thumbnail.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(thumbnail.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                      {thumbnail.type}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setThumbnail(null);
                      if (thumbInputRef.current)
                        thumbInputRef.current.value = "";
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">Add a cover image</div>
                    <div className="text-xs text-muted-foreground">
                      Optional — leave empty for the default PDF icon
                    </div>
                  </div>
                </>
              )}
            </label>
            <input
              ref={thumbInputRef}
              id="cutting-list-thumb"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
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
            <Button type="submit" disabled={submitting || !file}>
              {submitting ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
