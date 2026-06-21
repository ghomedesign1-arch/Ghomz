import Link from "next/link";
import { FileText, Image as ImageIcon, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { DeleteCuttingListButton } from "@/components/dialogs/delete-cutting-list-button";
import { CuttingListPreviewDialog } from "@/components/dialogs/cutting-list-preview-dialog";
import { EditCuttingListDialog } from "@/components/dialogs/edit-cutting-list-dialog";

export const dynamic = "force-dynamic";

async function load() {
  try {
    // Only base products show up here — variants share the parent's cutting
    // list since the sponge cut shapes don't change between Base and Premium.
    const products = await prisma.product.findMany({
      where: { parentId: null },
      include: {
        cuttingLists: {
          include: { uploadedBy: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });
    return { products, ready: true as const };
  } catch {
    return {
      products: [] as Awaited<ReturnType<typeof prisma.product.findMany>>,
      ready: false as const,
    };
  }
}

export default async function CuttingListsPage() {
  const [{ products, ready }, writeAccess] = await Promise.all([
    load(),
    canWrite(),
  ]);

  const totalFiles = products.reduce(
    (a, p) => a + ((p as { cuttingLists?: unknown[] }).cuttingLists?.length ?? 0),
    0,
  );
  const productsWithFiles = products.filter(
    (p) => (p as { cuttingLists?: unknown[] }).cuttingLists?.length,
  ).length;

  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sponge cutting lists"
        description="Upload the PDF or image catalogs the factory uses to cut sponge for each product. Files are stored locally and downloadable straight from this page."
        actions={
          writeAccess && ready ? (
            <UploadCuttingListDialog products={productOptions} />
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Files uploaded"
          value={`${totalFiles}`}
          hint="Across all products"
        />
        <Tile
          label="Products documented"
          value={`${productsWithFiles}`}
          hint={`of ${products.length} active SKUs`}
        />
        <Tile
          label="Catalog coverage"
          value={
            products.length === 0
              ? "—"
              : `${Math.round((productsWithFiles / products.length) * 100)}%`
          }
          hint={
            productsWithFiles < products.length
              ? "Some products still need a cutting list"
              : "All products have at least one file"
          }
        />
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
            No products yet. Create a product first from the Products page.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {products.map((p) => {
            const files =
              (p as { cuttingLists?: CuttingListFile[] }).cuttingLists ?? [];
            return (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Link
                        href={`/products/${p.id}`}
                        className="hover:underline"
                      >
                        {p.name}
                      </Link>
                      <Badge variant="secondary" className="text-[10px]">
                        {p.sku}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {files.length === 0
                        ? "No cutting list uploaded yet."
                        : `${files.length} file${files.length === 1 ? "" : "s"} attached`}
                    </CardDescription>
                  </div>
                  {writeAccess && (
                    <UploadCuttingListDialog
                      products={productOptions}
                      defaultProductId={p.id}
                      triggerLabel="Upload"
                      triggerVariant="outline"
                    />
                  )}
                </CardHeader>
                {files.length > 0 && (
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {files.map((f) => (
                        <FileCard
                          key={f.id}
                          file={f}
                          writeAccess={writeAccess}
                        />
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

type CuttingListFile = {
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
};

function FileCard({
  file,
  writeAccess,
}: {
  file: CuttingListFile;
  writeAccess: boolean;
}) {
  // Detect CAD files by extension — their MIME type is unreliable (often
  // `application/octet-stream` or `image/vnd.dwg`) so we'd otherwise mistake
  // a DWG for an image and try to <img>-render it.
  const ext = (file.fileName.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "").toLowerCase();
  const isCad = ext === "dwg" || ext === "dxf";
  const isImage = !isCad && file.fileType.startsWith("image/");
  // Label shown on the placeholder tile. Prefer the actual extension when it
  // gives a recognisable name (PDF, DWG, DXF…); fall back to the MIME subtype.
  const typeLabel =
    ext && ext.length <= 4
      ? ext.toUpperCase()
      : (file.fileType.split("/")[1] ?? "FILE").toUpperCase();
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
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
              // Custom cover image uploaded with the file.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.thumbnailPath}
                alt={file.fileName}
                className="h-full w-full object-cover"
              />
            ) : isImage ? (
              // The file itself is already an image.
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
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {file.uploadedBy?.name ? `by ${file.uploadedBy.name} · ` : ""}
            {file.createdAt.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          <div className="flex items-center gap-1">
            <CuttingListPreviewDialog
              cuttingListId={file.id}
              filePath={file.filePath}
              fileName={file.fileName}
              fileType={file.fileType}
              title={file.title}
            />
            <Button asChild variant="ghost" size="sm" className="h-7 px-2">
              <a href={`/api/cutting-lists/${file.id}/download`}>
                Download
              </a>
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
