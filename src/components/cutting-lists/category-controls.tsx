"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, FolderTree, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface CategoryOption {
  id: string;
  name: string;
}

const PALETTE = [
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
];
const NONE_TONE = "bg-slate-100 text-slate-600 border-slate-200";

export function categoryTone(index: number): string {
  return index < 0 ? NONE_TONE : PALETTE[index % PALETTE.length];
}

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

/** Category pill; for editors it doubles as a dropdown to change the category. */
export function CategoryBadge({
  itemId,
  categoryId,
  categories,
  canEdit,
}: {
  itemId: string;
  categoryId: string | null;
  categories: CategoryOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const index = categories.findIndex((c) => c.id === categoryId);
  const label = index >= 0 ? categories[index].name : "No category";
  const tone = categoryTone(index);

  if (!canEdit) {
    return (
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
        {label}
      </span>
    );
  }

  async function change(next: string) {
    setBusy(true);
    try {
      await send(`/api/cutting-lists/items/${itemId}`, "PATCH", {
        categoryId: next || null,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value={categoryId ?? ""}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      title="Change category"
      className={`cursor-pointer appearance-none rounded-full border px-2 py-0.5 text-[10px] font-semibold outline-none ${tone}`}
    >
      <option value="">No category</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

export function ManageCategoriesButton({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [list, setList] = React.useState(categories);
  const [newName, setNewName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setList(categories);
  }, [categories]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setList(categories);
    } finally {
      setBusy(false);
    }
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    run(() => send("/api/cutting-lists/categories", "PUT", { ids: next.map((c) => c.id) }));
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      await send("/api/cutting-lists/categories", "POST", { name });
      setNewName("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FolderTree className="h-4 w-4" /> Categories
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>
            The cutting-lists page shows categories in this order, top first.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {list.length === 0 && (
            <li className="text-sm text-muted-foreground">No categories yet.</li>
          )}
          {list.map((c, i) => (
            <CategoryRow
              key={c.id}
              category={c}
              index={i}
              isFirst={i === 0}
              isLast={i === list.length - 1}
              busy={busy}
              onMove={(dir) => move(i, dir)}
              onRename={(name) =>
                run(() => send(`/api/cutting-lists/categories/${c.id}`, "PATCH", { name }))
              }
              onDelete={() => {
                if (!confirm(`Delete category "${c.name}"? Its items become "No category".`))
                  return;
                run(() => send(`/api/cutting-lists/categories/${c.id}`, "DELETE"));
              }}
            />
          ))}
        </ul>

        <form onSubmit={add} className="flex gap-2 pt-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category, e.g. Beds"
          />
          <Button type="submit" disabled={busy || !newName.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({
  category,
  index,
  isFirst,
  isLast,
  busy,
  onMove,
  onRename,
  onDelete,
}: {
  category: CategoryOption;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (dir: -1 | 1) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = React.useState(category.name);
  React.useEffect(() => setName(category.name), [category.name]);
  const dirty = name.trim() !== category.name && name.trim().length > 0;

  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${categoryTone(index)}`}
      >
        {index + 1}
      </span>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8"
      />
      {dirty && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRename(name.trim())} title="Save name">
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={busy || isFirst} onClick={() => onMove(-1)} title="Move up">
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" disabled={busy || isLast} onClick={() => onMove(1)} title="Move down">
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={onDelete} title="Delete">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}
