import { HttpError, requireRole, withApi } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_VERSION = "2026-07";
const QUERY = "query ConnectionTest { shop { name myshopifyDomain } }";

// This route is the server-only boundary: credentials and tokens never leave it.
export const GET = withApi(async () => {
  await requireRole("ADMIN");

  const rawShop = (process.env.SHOPIFY_SHOP ?? process.env.shopify_shop)?.trim().toLowerCase();
  const clientId = (process.env.SHOPIFY_CLIENT_ID ?? process.env.shopify_client_id)?.trim();
  const clientSecret = (process.env.SHOPIFY_CLIENT_SECRET ?? process.env.shopify_client_secret)?.trim();
  if (!rawShop || !clientId || !clientSecret) {
    throw new HttpError(503, "Shopify connection is not configured.");
  }

  const shop = rawShop.endsWith(".myshopify.com")
    ? rawShop
    : `${rawShop}.myshopify.com`;
  // No arbitrary hosts, ports, paths or redirects may receive credentials.
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    throw new HttpError(503, "Shopify shop configuration is invalid.");
  }

  let stage = "authentication";
  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) throw new Error();
    const token = await tokenResponse.json();
    if (typeof token?.access_token !== "string" || !token.access_token ||
        typeof token.expires_in !== "number" || token.expires_in <= 0) {
      throw new Error();
    }

    stage = "identity query";
    const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token.access_token,
      },
      body: JSON.stringify({ query: QUERY }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new HttpError(502, `Shopify identity query failed (HTTP ${response.status}).`);
    stage = "identity response decoding";
    const result = await response.json();
    stage = "identity response validation";
    const identity = result?.data?.shop;
    if (result?.errors?.length) throw new HttpError(502, "Shopify rejected the identity GraphQL query.");
    if (typeof identity?.name !== "string" ||
        typeof identity?.myshopifyDomain !== "string" ||
        !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(identity.myshopifyDomain.toLowerCase())) {
      throw new Error();
    }

    // Shopify may return the original permanent domain for a branded alias.
    // Identity comes from the authenticated API on the configured host;
    // never use the returned domain as a new credential destination.
    return Response.json({
      ok: true,
      shop: { name: identity.name, myshopifyDomain: identity.myshopifyDomain },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // Never pass upstream bodies, tokens, fetch errors or causes to withApi,
    // whose generic error handler logs unexpected errors.
    const reason = error instanceof Error && ["AbortError", "TimeoutError", "TypeError", "SyntaxError"].includes(error.name)
      ? ` (${error.name})` : "";
    throw new HttpError(502, `Shopify ${stage} failed${reason}.`);
  }
});
