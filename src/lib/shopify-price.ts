import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/rbac";

// Explicit, reviewed mapping. Never infer a Shopify target from a name or SKU.
export const MUFFIN_ERP_ID = "cmuvdzv1k000087mhwf7uk4w5";
const PRODUCT = "gid://shopify/Product/8714227810475";
const VARIANT = "gid://shopify/ProductVariant/46363984396459";
const DOMAIN = "13e79d-01.myshopify.com";
export const PRICE_QUERY = `query PricePreview($id: ID!) {
  shop { myshopifyDomain currencyCode }
  currentAppInstallation { accessScopes { handle } }
  productVariant(id: $id) { id title price product { id title status updatedAt } }
}`;
export const PRICE_MUTATION = `mutation SyncRetailPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants, allowPartialUpdates: false) {
    productVariants { id price }
    userErrors { field message }
  }
}`;
export function money(value: string | number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
    throw new HttpError(422, "Set a positive retail price with no more than two decimal places.");
  }
  return amount.toFixed(2);
}

export async function shopifyClient() {
  const raw = (process.env.SHOPIFY_SHOP ?? process.env.shopify_shop)?.trim().toLowerCase();
  const id = (process.env.SHOPIFY_CLIENT_ID ?? process.env.shopify_client_id)?.trim();
  const secret = (process.env.SHOPIFY_CLIENT_SECRET ?? process.env.shopify_client_secret)?.trim();
  const host = raw?.endsWith(".myshopify.com") ? raw : `${raw}.myshopify.com`;
  if (!raw || !id || !secret || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host)) {
    throw new HttpError(503, "Shopify connection is not configured.");
  }
  let token: string;
  try {
    const response = await fetch(`https://${host}/admin/oauth/access_token`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
    });
    const data = await response.json();
    if (!response.ok || typeof data.access_token !== "string" || !data.access_token) throw new Error();
    token = data.access_token;
  } catch { throw new HttpError(502, "Shopify authentication failed."); }

  return async (query: string, variables: Record<string, unknown>) => {
    try {
      const response = await fetch(`https://${host}/admin/api/2026-07/graphql.json`, {
        method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      if (!response.ok || result.errors?.length || !result.data) throw new Error();
      return result.data;
    } catch {
      // Do not log raw upstream errors or retry a possibly-applied mutation.
      throw new HttpError(502, "Shopify request could not be verified. Refresh the preview before trying again.");
    }
  };
}
export type ShopifyClient = Awaited<ReturnType<typeof shopifyClient>>;
export async function readPrice(client: ShopifyClient) {
  const data = await client(PRICE_QUERY, { id: VARIANT });
  const variant = data.productVariant;
  if (data.shop?.myshopifyDomain !== DOMAIN || data.shop?.currencyCode !== "EGP" ||
      variant?.id !== VARIANT || variant.product?.id !== PRODUCT ||
      typeof variant.product.updatedAt !== "string") {
    throw new HttpError(409, "The Shopify store or product link no longer matches. No price was changed.");
  }
  if (!data.currentAppInstallation?.accessScopes?.some((scope: { handle: string }) => scope.handle === "write_products")) {
    throw new HttpError(403, "The Shopify app needs write_products permission to sync prices.");
  }
  return { price: money(variant.price), title: variant.product.title as string,
    variant: variant.title as string, status: variant.product.status as string,
    updatedAt: variant.product.updatedAt as string };
}
export async function writePrice(client: ShopifyClient, price: string) {
  const data = await client(PRICE_MUTATION, { productId: PRODUCT,
    variants: [{ id: VARIANT, price: money(price) }] });
  const result = data.productVariantsBulkUpdate;
  if (!result || result.userErrors?.length || result.productVariants?.length !== 1 ||
      result.productVariants[0].id !== VARIANT || money(result.productVariants[0].price) !== price) {
    throw new HttpError(502, "Shopify did not confirm the price update. Refresh the preview to check its current price.");
  }
}
export interface PriceApproval {
  userId: string; productId: string; erpUpdatedAt: string;
  shopifyUpdatedAt: string; oldPrice: string; newPrice: string; expiresAt: number;
}
function signingKey() {
  const key = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!key) throw new HttpError(503, "Price confirmation is not configured.");
  return key;
}
export function signApproval(approval: PriceApproval) {
  const payload = Buffer.from(JSON.stringify(approval)).toString("base64url");
  return `${payload}.${createHmac("sha256", signingKey()).update(payload).digest("base64url")}`;
}
export function verifyApproval(token: unknown, userId: string, productId: string): PriceApproval {
  const key = signingKey();
  try {
    if (typeof token !== "string" || token.length > 4096) throw new Error();
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) throw new Error();
    const actual = Buffer.from(signature, "base64url");
    const expected = createHmac("sha256", key).update(payload).digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const approval = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (approval.userId !== userId || approval.productId !== productId ||
        !Number.isFinite(approval.expiresAt) || approval.expiresAt <= Date.now()) throw new Error();
    return approval;
  } catch { throw new HttpError(409, "This preview expired or is invalid. Open a fresh price preview."); }
}
