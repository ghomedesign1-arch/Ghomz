"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

interface BrandLogoUploaderProps {
  /** Current logo URL (server-resolved). null = no custom logo set. */
  initialUrl: string | null;
  /** Whether the active user can change the logo (ADMIN only). */
  editable: boolean;
}

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Client-side uploader for the brand logo. Shows a 96px live preview, two
 * actions (Replace / Remove), and uses a soft confirm dialog before destroying
 * an existing logo.
 *
 * Submits multipart to `/api/brand/logo` (POST) and triggers `router.refresh()`
 * so the sidebar and any other server components pick up the new URL.
 */
export function BrandLogoUploader({
  initialUrl,
  editable,
}: BrandLogoUploaderProps) {
  const router = useRouter();
  const [url, setUrl] = React.useState(initialUrl);
  const [uploading, setUploading] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onPickFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(`Logo too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
      return;
    }
    if (!/^image\/(svg\+xml|png|jpe?g|webp)$/.test(file.type)) {
      toast.error("Use SVG, PNG, JPG or WEBP");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/brand/logo", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
      const data = (await res.json()) as { url: string };
      setUrl(data.url);
      toast.success("Logo updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove() {
    setRemoving(true);
    try {
      const res = await fetch("/api/brand/logo", { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Remove failed (${res.status})`);
      }
      setUrl(null);
      toast.success("Logo removed — default mark restored");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setRemoving(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div
        className={cn(
          "relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-sand-100 dark:bg-sand-800",
          uploading && "opacity-60",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Brand logo" className="h-full w-full object-contain p-2" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/g-homz-logo.svg"
            alt="G-Homz default mark"
            className="h-3/4 w-3/4 object-contain opacity-80"
          />
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div>
          <div className="text-sm font-medium">
            {url ? "Custom brand logo" : "Default G-Homz mark"}
          </div>
          <div className="text-xs text-muted-foreground">
            Shown in the sidebar. SVG, PNG, JPG or WEBP · square preferred · up to 4 MB.
          </div>
        </div>

        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  {url ? <ImageIcon className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                  {url ? "Replace logo" : "Upload logo"}
                </>
              )}
            </Button>
            {url && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmOpen(true)}
                disabled={removing}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/svg+xml,image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
              }}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Only admins can change the brand logo.
          </p>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove brand logo?</AlertDialogTitle>
            <AlertDialogDescription>
              The default G-Homz mark will be shown until you upload a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemove}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Removing…
                </>
              ) : (
                "Remove logo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
