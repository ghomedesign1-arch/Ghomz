import { HttpError, withApi } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shopify kids-bed product import endpoint — disabled.
 *
 * Products are no longer synced from Shopify; this route is kept so any
 * stale link / bookmark lands on a clear 410 Gone rather than a surprise
 * import. Shopify ORDERS still flow in untouched via /api/shopify/orders/*.
 */
async function gone(): Promise<Response> {
  throw new HttpError(410, "Shopify product import is disabled on this account.");
}

export const GET = withApi(gone);
export const POST = withApi(gone);
