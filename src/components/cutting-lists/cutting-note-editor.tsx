"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, StickyNote, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiPatch } from "@/lib/api-client";

interface CuttingNoteEditorProps {
  productId: string;
  initialNote: string | null;
  /** When false, the note renders read-only (no edit button). */
  canEdit: boolean;
}

/**
 * Per-product note shown on the cutting-lists page. Click the small Edit
 * pencil to swap into a textarea + Save/Cancel; Save flushes to
 * PATCH /api/products/:id/cutting-note and refreshes the server tree.
 *
 * Empty notes collapse the block down to a thin "Add note" link so a row
 * without notes doesn't waste vertical space.
 */
export function CuttingNoteEditor({
  productId,
  initialNote,
  canEdit,
}: CuttingNoteEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(initialNote ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft(initialNote ?? "");
  }, [initialNote]);

  async function save(value: string | null) {
    setSaving(true);
    try {
      await apiPatch(`/api/products/${productId}/cutting-note`, { note: value });
      toast.success(value ? "Note saved" : "Note cleared");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    const isEmpty = !initialNote || initialNote.trim().length === 0;
    if (isEmpty) {
      return canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <StickyNote className="h-3.5 w-3.5" />
          Add cutting note
        </button>
      ) : null;
    }
    return (
      <div className="rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-950/30">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
            <p className="whitespace-pre-wrap text-[12px] leading-snug text-foreground/90">
              {initialNote}
            </p>
          </div>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-mr-2 -mt-1 h-7 px-2 text-[11px]"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-secondary/30 p-3">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        autoFocus
        placeholder="e.g. Use 7 cm blade. Cut the inner sponge first."
        className="text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-rose-700 hover:text-rose-700 dark:text-rose-400"
          onClick={() => save(null)}
          disabled={saving || !initialNote}
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </Button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              setDraft(initialNote ?? "");
              setEditing(false);
            }}
            disabled={saving}
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-3 text-[11px]"
            onClick={() => save(draft)}
            disabled={saving || draft === (initialNote ?? "")}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
