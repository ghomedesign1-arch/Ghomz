"use client";

import * as React from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2, Palette, Upload, X } from "lucide-react";
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

export function InvoiceBrandingDialog() {
  const [open, setOpen] = React.useState(false);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [curveFile, setCurveFile] = React.useState<File | null>(null);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [curveUrl, setCurveUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Load current branding when the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/invoice-branding")
      .then((r) => r.json())
      .then((data) => {
        setLogoUrl(data.logoUrl ?? null);
        setCurveUrl(data.bottomCurveUrl ?? null);
      })
      .catch(() => toast.error("Failed to load branding"))
      .finally(() => setLoading(false));
  }, [open]);

  async function save() {
    if (!logoFile && !curveFile) {
      toast.info("Pick at least one new image to upload");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      if (logoFile) fd.append("logo", logoFile);
      if (curveFile) fd.append("bottomCurve", curveFile);
      const res = await fetch("/api/invoice-branding", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      setLogoUrl(data.logoUrl ?? null);
      setCurveUrl(data.bottomCurveUrl ?? null);
      setLogoFile(null);
      setCurveFile(null);
      toast.success("Invoice branding updated");
    } finally {
      setSaving(false);
    }
  }

  async function remove(target: "logo" | "curve") {
    const res = await fetch(`/api/invoice-branding?target=${target}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    if (target === "logo") setLogoUrl(null);
    else setCurveUrl(null);
    toast.success("Removed");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Palette className="h-3.5 w-3.5" />
          Invoice branding
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Invoice branding</DialogTitle>
          <DialogDescription>
            Upload the logo and the decorative bottom curve as transparent PNGs.
            Both are stored on Cloudinary — change them any time without a
            redeploy.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-5">
            <BrandSlot
              label="Logo (top-left)"
              hint="Transparent PNG, at least 400 px wide."
              currentUrl={logoUrl}
              draft={logoFile}
              onPick={setLogoFile}
              onRemove={() => remove("logo")}
            />
            <BrandSlot
              label="Bottom curve (bottom-right)"
              hint="Transparent PNG of the black wave shape."
              currentUrl={curveUrl}
              draft={curveFile}
              onPick={setCurveFile}
              onRemove={() => remove("curve")}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving || (!logoFile && !curveFile)}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrandSlot({
  label,
  hint,
  currentUrl,
  draft,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  currentUrl: string | null;
  draft: File | null;
  onPick: (f: File | null) => void;
  onRemove: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previewUrl = draft ? URL.createObjectURL(draft) : currentUrl;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {currentUrl && !draft && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
      <div
        className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/30 p-3 text-sm transition-colors hover:bg-secondary/50"
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl ? (
          <div className="h-16 w-24 shrink-0 rounded-md border border-border bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md border border-border bg-white text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            {draft
              ? draft.name
              : currentUrl
                ? "Current image — click to replace"
                : "Click to pick an image"}
          </div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
