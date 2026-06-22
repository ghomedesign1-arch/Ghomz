import Link from "next/link";
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

export const dynamic = "force-dynamic";

async function load() {
  try {
    // Only base products show up here — variants share the parent's cutting
    // list since the sponge cut shapes don't change between Base and Premium.
    const products = await prisma.product.findMany({
      where: { parentId: null },
      include: {
        cuttingLists: {
          include: {
            uploadedBy: { select: { name: true } },
            doneBy: { select: { name: true } },
          },
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
            const doneCount = files.filter((f) => f.done).length;
            const allDone = files.length > 0 && doneCount === files.length;
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
                    <ProductFilesSection
                      productId={p.id}
                      files={files}
                      writeAccess={writeAccess}
                    />
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
