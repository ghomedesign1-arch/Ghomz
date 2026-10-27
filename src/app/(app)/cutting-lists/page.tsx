import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { canWrite } from "@/lib/rbac";
import { UploadCuttingListDialog } from "@/components/dialogs/upload-cutting-list-dialog";
import {
  ProductFilesSection,
  type CuttingListFile,
} from "@/components/cutting-lists/product-files-section";
import { CuttingNoteEditor } from "@/components/cutting-lists/cutting-note-editor";
import {
  AddCuttingItemButton,
  CuttingItemActions,
} from "@/components/cutting-lists/item-controls";
import { ensureCuttingListsMigrated } from "@/lib/cutting-lists";

export const dynamic = "force-dynamic";

async function load() {
  try {
    await ensureCuttingListsMigrated();
    const items = await prisma.cuttingListItem.findMany({
      include: {
        files: {
          include: {
            uploadedBy: { select: { name: true } },
            doneBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });
    return { items, ready: true as const };
  } catch (e) {
    console.error("[cutting-lists] load failed", e);
    return { items: [], ready: false as const };
  }
}

export default async function CuttingListsPage() {
  const [{ items, ready }, writeAccess] = await Promise.all([
    load(),
    canWrite(),
  ]);

  const totalFiles = items.reduce((a, i) => a + i.files.length, 0);
  const itemsWithFiles = items.filter((i) => i.files.length > 0).length;
  const itemOptions = items.map((i) => ({ id: i.id, name: i.name }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sponge cutting lists"
        description="Upload the PDF, image or DWG/DXF files the factory uses to cut sponge. This section is separate from Products — add and name items freely."
        actions={
          writeAccess && ready ? (
            <>
              <AddCuttingItemButton />
              <UploadCuttingListDialog items={itemOptions} />
            </>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Files uploaded"
          value={`${totalFiles}`}
          hint="Across all items"
        />
        <Tile
          label="Items documented"
          value={`${itemsWithFiles}`}
          hint={`of ${items.length} items`}
        />
        <Tile
          label="Coverage"
          value={
            items.length === 0
              ? "—"
              : `${Math.round((itemsWithFiles / items.length) * 100)}%`
          }
          hint={
            itemsWithFiles < items.length
              ? "Some items still need a cutting list"
              : "All items have at least one file"
          }
        />
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
            No items yet. Click <b>Add item</b> to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const files = item.files as CuttingListFile[];
            const doneCount = files.filter((f) => f.done).length;
            const allDone = files.length > 0 && doneCount === files.length;
            return (
              <Card key={item.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {item.name}
                      {files.length > 0 && (
                        <Badge
                          variant={allDone ? "success" : "outline"}
                          className="gap-1 text-[10px]"
                        >
                          {allDone && <Check className="h-3 w-3" />}
                          {doneCount}/{files.length} done
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {files.length === 0
                        ? "No cutting list uploaded yet."
                        : `${files.length} file${files.length === 1 ? "" : "s"} attached`}
                    </CardDescription>
                  </div>
                  {writeAccess && (
                    <div className="flex items-center gap-1">
                      <CuttingItemActions
                        itemId={item.id}
                        name={item.name}
                        fileCount={files.length}
                      />
                      <UploadCuttingListDialog
                        items={itemOptions}
                        defaultItemId={item.id}
                        triggerLabel="Upload"
                        triggerVariant="outline"
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <CuttingNoteEditor
                    itemId={item.id}
                    initialNote={item.note ?? null}
                    canEdit={writeAccess}
                  />
                  {files.length > 0 && (
                    <ProductFilesSection
                      itemId={item.id}
                      files={files}
                      writeAccess={writeAccess}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
