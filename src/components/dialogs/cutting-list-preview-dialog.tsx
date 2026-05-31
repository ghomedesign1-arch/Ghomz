"use client";

import * as React from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PreviewDialogProps {
  filePath: string;
  fileName: string;
  fileType: string;
  title?: string | null;
  triggerLabel?: string;
  /** Custom trigger element. If omitted, a small "View" button is used. */
  trigger?: React.ReactNode;
}

/**
 * In-app preview for cutting-list files. PDFs render inline via `<iframe>`
 * (every modern browser ships a PDF viewer) and images render as `<img>`.
 *
 * Designed to stay edge-to-edge inside a Dialog so multi-page PDFs and large
 * scanned diagrams fit on screen.
 */
export function CuttingListPreviewDialog({
  filePath,
  fileName,
  fileType,
  title,
  triggerLabel = "View",
  trigger,
}: PreviewDialogProps) {
  const [open, setOpen] = React.useState(false);
  const isImage = fileType.startsWith("image/") && !/dwg|dxf/i.test(fileType);
  const isPdf = fileType === "application/pdf";
  // DWG/DXF: detect by extension because the MIME often comes through as
  // `application/octet-stream` or `application/acad`. CAD files can't be
  // previewed inline — we surface a tidy "open in AutoCAD" message instead.
  const ext = (fileName.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "").toLowerCase();
  const isCad = ext === "dwg" || ext === "dxf";
  const displayTitle = title ?? fileName;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="h-7 px-2">
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="!max-w-5xl gap-0 overflow-hidden p-0"
        // Cap the dialog at viewport height and let the preview area scroll.
      >
        <DialogTitle className="sr-only">{displayTitle}</DialogTitle>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-display text-base font-semibold tracking-tight">
              {displayTitle}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {fileName} · {fileType}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="sm">
              <a href={filePath} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Open in tab
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={filePath} download={fileName}>
                <Download className="h-4 w-4" /> Download
              </a>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="h-[80vh] w-full bg-sand-100 dark:bg-sand-900">
          {isPdf && (
            <iframe
              src={filePath}
              title={displayTitle}
              className="h-full w-full"
            />
          )}
          {isImage && (
            <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={filePath}
                alt={displayTitle}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          {!isPdf && !isImage && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
              {isCad ? (
                <>
                  <div className="rounded-full bg-sand-200 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sand-800 dark:bg-sand-700 dark:text-sand-100">
                    AutoCAD · {ext.toUpperCase()}
                  </div>
                  <span className="max-w-md">
                    {ext.toUpperCase()} files can&apos;t be previewed in the
                    browser. Download to open in AutoCAD, LibreCAD or any
                    DWG viewer.
                  </span>
                </>
              ) : (
                <span>Preview not supported for {fileType || ext.toUpperCase() || "this file"}.</span>
              )}
              <Button asChild variant="outline">
                <a href={filePath} download={fileName}>
                  <Download className="h-4 w-4" /> Download to view
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
