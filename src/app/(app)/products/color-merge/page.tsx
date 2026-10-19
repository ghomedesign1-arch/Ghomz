import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { ColorMergePreview } from "@/components/products/color-merge-preview";

export const dynamic = "force-dynamic";

export default function ColorMergePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Merge colour-only variants"
        description="Collapses variants under the same parent that differ only in colour. One canonical variant is kept per (dimension + mattress option) combo; the extras keep existing (deactivated) and their SKUs become aliases so Shopify orders still resolve."
      />

      <Card>
        <CardContent className="space-y-3 px-6 py-5 text-sm">
          <div className="font-medium">What this does</div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Groups each parent product's variants by stripping colour names
              from the variant title. Known colours include blue, beige,
              green, grey, ivory, taupe, etc. — add more in
              <code className="rounded bg-muted px-1 text-xs"> src/lib/variant-detect.ts</code>.
            </li>
            <li>
              Keeps the first variant in each group as the canonical ERP
              product; the others' SKUs are copied into its{" "}
              <code className="rounded bg-muted px-1 text-xs">aliasSkus</code>{" "}
              so Shopify orders match either way.
            </li>
            <li>
              Extras are not deleted — they are deactivated (
              <code className="rounded bg-muted px-1 text-xs">active: false</code>
              ), so they disappear from the catalogue list but history,
              BOMs and SKUs are preserved.
            </li>
            <li>Variants that already have no colour part are left alone.</li>
          </ul>
          <div className="text-xs text-muted-foreground">
            Back to the{" "}
            <Link href="/products" className="underline">
              products list
            </Link>
            .
          </div>
        </CardContent>
      </Card>

      <ColorMergePreview />
    </div>
  );
}
