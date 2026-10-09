import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getShopifyToken } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export default async function ShopifyOrdersPage() {
  const connection = await getShopifyToken().catch(() => null);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Shopify orders"
        description="Orders synced from your g-homz.myshopify.com storefront."
      />
      <Card>
        <CardContent className="space-y-3 px-6 py-8 text-sm">
          {connection ? (
            <>
              <div className="text-base font-medium">Connected to {connection.shop}.</div>
              <p className="text-muted-foreground">
                Order sync + management UI is being wired up. The access token is
                stored and will be used by the backfill job next.
              </p>
            </>
          ) : (
            <>
              <div className="text-base font-medium">Not connected yet.</div>
              <p className="text-muted-foreground">
                Click Install below to grant the ERP read access to your Shopify
                orders. You&apos;ll be sent to Shopify, confirm the scopes, and
                land back here.
              </p>
              <Link
                href="/api/shopify/install"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Install Shopify connection
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
