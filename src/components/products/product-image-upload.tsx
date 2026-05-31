"use client";

import * as React from "react";
import Image from "next/image";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProductImageUploadProps {
  productId: string;
  imageUrl: string | null;
  /** Display size in pixels (square). Defaults to 40 */
  size?: number;
  /** Show name initial as fallback */
  initial?: string;
  /** Allow uploading / deleting */
  editable?: boolean;
  className?: string;
}

export function ProductImageUpload({
  productId,
  imageUrl,
  size = 40,
  initial = "?",
  editable = false,
  className,
}: ProductImageUploadProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [localUrl, setLocalUrl] = React.useState<string | null>(imageUrl);

  // Keep in sync with server refreshes
  React.useEffect(() => { setLocalUrl(imageUrl); }, [imageUrl]);

  async function handleFile(file: File) {
    setUploading(true);
    // Optimistic preview
    const preview = URL.createObjectURL(file);
    setLocalUrl(preview);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/products/${productId}/image`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Upload failed");
      }
      const data = await res.json();
      setLocalUrl(data.imageUrl);
      toast.success("Product image updated");
      router.refresh();
    } catch (err) {
      setLocalUrl(imageUrl); // revert optimistic
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(preview);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!localUrl) return;
    const prev = localUrl;
    setLocalUrl(null);
    try {
      const res = await fetch(`/api/products/${productId}/image`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Image removed");
      router.refresh();
    } catch {
      setLocalUrl(prev);
      toast.error("Could not remove image");
    }
  }

  const rounded = `rounded-xl`;

  return (
    <div
      className={cn("relative shrink-0 group", className)}
      style={{ width: size, height: size }}
    >
      {/* Avatar / image */}
      {localUrl ? (
        <Image
          src={localUrl}
          alt="Product"
          fill
          sizes={`${size}px`}
          className={cn("object-cover", rounded)}
          unoptimized={localUrl.startsWith("blob:")}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-sand-100 text-sand-700 dark:bg-sand-800 dark:text-sand-200",
            rounded,
          )}
        >
          <span
            className="font-semibold select-none"
            style={{ fontSize: Math.max(12, Math.round(size * 0.35)) }}
          >
            {initial}
          </span>
        </div>
      )}

      {/* Editable overlay */}
      {editable && (
        <>
          {/* Upload trigger */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-0.5",
              "bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity",
              "text-white text-[9px] font-medium",
              rounded,
            )}
            aria-label="Upload product image"
          >
            <Camera className="h-4 w-4" />
            <span>{uploading ? "Uploading…" : "Upload"}</span>
          </button>

          {/* Delete button — only when image exists */}
          {localUrl && !uploading && (
            <button
              type="button"
              onClick={handleDelete}
              className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
              aria-label="Remove image"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}
