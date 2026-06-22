"use client";

import * as React from "react";
import {
  ArrowDownUp,
  Check,
  FileText,
  Image as ImageIcon,
  Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CuttingListPreviewDialog } from "@/components/dialogs/cutting-list-preview-dialog";
import { EditCuttingListDialog } from "@/components/dialogs/edit-cutting-list-dialog";
import { DeleteCuttingListButton } from "@/components/dialogs/delete-cutting-list-button";
import { MarkDoneToggle } from "@/components/cutting-lists/mark-done-toggle";

export type CuttingListFile = {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  thumbnailPath: string | null;
  thumbnailType: string | null;
  title: string | null;
  notes: string | null;
  createdAt: Date;
  uploadedBy?: { name: string } | null;
  done: boolean;
  doneAt: Date | null;
  doneBy?: { name: string } | null;
};

type SortKey =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "pending-first"
  | "done-first";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name A → Z" },
  { value: "name-desc", label: "Name Z → A" },
  { value: "pending-first", label: "Pending first" },
  { value: "done-first", label: "Done first" },
];

interface ProductFilesSectionProps {
  productId: string;
  files: CuttingListFile[];
  writeAccess: boolean;
}

/**
 * Per-product files grid with its own sort selector. Lives on the cutting
 * lists page; each product card uses its own instance so sort choices don't
 * cross-contaminate between products.
 *
 * Sort preference is remembered in localStorage keyed by productId so the
 * user's choice survives reloads — no DB round-trip needed.
 */
export function ProductFilesSection({
  productId,
  files,
  writeAccess,
}: ProductFilesSectionProps) {
  const storageKey = `cutting-lists:sort:${productId}`;
  const [sort, setSort] = React.useState<SortKey>("newest");

  React.useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved && SORT_OPTIONS.some((o) => o.value === saved)) {
      setSort(saved as SortKey);
    }
  }, [storageKey]);

  function updateSort(next: SortKey) {
    setSort(next);
    window.localStorage.setItem(storageKey, next);
  }

  const sorted = React.useMemo(() => sortFiles(files, sort), [files, sort]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <ArrowDownUp className="h-3.5 w-3.5" />
        <span>Sort</span>
        <Select value={sort} onValueChange={(v) => updateSort(v as SortKey)}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((f) => (
          <FileCard key={f.id} file={f} writeAccess={writeAccess} />
        ))}
      </div>
    </div>
  );
}

function sortFiles(files: CuttingListFile[], sort: SortKey): CuttingListFile[] {
  const arr = [...files];
  switch (sort) {
    case "newest":
      return arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    case "oldest":
      return arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    case "name-asc":
      return arr.sort((a, b) => name(a).localeCompare(name(b)));
    case "name-desc":
      return arr.sort((a, b) => name(b).localeCompare(name(a)));
    case "pending-first":
      return arr.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    case "done-first":
      return arr.sort((a, b) => {
        if (a.done !== b.done) return a.done ? -1 : 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }
}

function name(f: CuttingListFile): string {
  return (f.title ?? f.fileName).toLowerCase();
}

function FileCard({
  file,
  writeAccess,
}: {
  file: CuttingListFile;
  writeAccess: boolean;
}) {
  const ext = (file.fileName.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "").toLowerCase();
  const isCad = ext === "dwg" || ext === "dxf";
  const isImage = !isCad && file.fileType.startsWith("image/");
  const typeLabel =
    ext && ext.length <= 4
      ? ext.toUpperCase()
      : (file.fileType.split("/")[1] ?? "FILE").toUpperCase();
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card transition-colors",
        file.done &&
          "border-emerald-300/70 bg-emerald-50/40 dark:border-emerald-700/60 dark:bg-emerald-950/20",
      )}
    >
      {file.done && (
        <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          <Check className="h-3 w-3" /> Done
        </div>
      )}
      <CuttingListPreviewDialog
        cuttingListId={file.id}
        filePath={file.filePath}
        fileName={file.fileName}
        fileType={file.fileType}
        title={file.title}
        trigger={
          <button
            type="button"
            className="relative flex aspect-[16/9] w-full items-center justify-center bg-sand-100 transition-opacity hover:opacity-80 dark:bg-sand-800"
            aria-label={`Preview ${file.title ?? file.fileName}`}
          >
            {file.thumbnailPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.thumbnailPath}
                alt={file.fileName}
                className="h-full w-full object-cover"
              />
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.filePath}
                alt={file.fileName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <FileText className="h-10 w-10" />
                <span className="text-[10px] uppercase tracking-wider">
                  {typeLabel}
                </span>
                {isCad && (
                  <span className="rounded-full bg-sand-200 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sand-800 dark:bg-sand-700 dark:text-sand-100">
                    AutoCAD
                  </span>
                )}
              </div>
            )}
          </button>
        }
      />
      <div className="space-y-1 p-3">
        <div className="flex items-start gap-2">
          {isImage ? (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Scissors className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {file.title ?? file.fileName}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {file.fileName} · {(file.fileSize / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        </div>
        {file.notes && (
          <p className="line-clamp-2 text-[11px] text-muted-foreground">
            {file.notes}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">
            {file.done && file.doneAt ? (
              <>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  Done{file.doneBy?.name ? ` by ${file.doneBy.name}` : ""}
                </span>{" "}
                ·{" "}
                {file.doneAt.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </>
            ) : (
              <>
                {file.uploadedBy?.name ? `by ${file.uploadedBy.name} · ` : ""}
                {file.createdAt.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </>
            )}
          </span>
          <div className="flex items-center gap-1">
            {writeAccess && (
              <MarkDoneToggle cuttingListId={file.id} done={file.done} />
            )}
            <CuttingListPreviewDialog
              cuttingListId={file.id}
              filePath={file.filePath}
              fileName={file.fileName}
              fileType={file.fileType}
              title={file.title}
            />
            <Button asChild variant="ghost" size="sm" className="h-7 px-2">
              <a href={`/api/cutting-lists/${file.id}/download`}>Download</a>
            </Button>
            {writeAccess && (
              <EditCuttingListDialog
                cuttingList={{
                  id: file.id,
                  title: file.title,
                  notes: file.notes,
                  fileName: file.fileName,
                  fileType: file.fileType,
                  fileSize: file.fileSize,
                  thumbnailPath: file.thumbnailPath,
                }}
              />
            )}
            {writeAccess && (
              <DeleteCuttingListButton
                cuttingListId={file.id}
                fileName={file.fileName}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
