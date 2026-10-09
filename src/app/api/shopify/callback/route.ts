import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getShopifyEnv,
  saveShopifyToken,
  verifyOAuthHmac,
} from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { clientSecret, shop: expectedShop } = getShopifyEnv();
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { code, shop, state, hmac } = params;

  if (!code || !shop || !hmac) {
    return NextResponse.json(
      { error: "Missing required OAuth params" },
      { status: 400 },
    );
  }

  if (shop !== expectedShop) {
    return NextResponse.json(
      { error: `Unexpected shop domain: ${shop}` },
      { status: 400 },
    );
  }

  if (!verifyOAuthHmac(params, clientSecret)) {
    return NextResponse.json({ error: "Bad HMAC" }, { status: 401 });
  }

  const expectedState = req.cookies.get("shopify_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.json({ error: "Bad state" }, { status: 400 });
  }

  try {
    const { access_token, scope } = await exchangeCodeForToken(shop, code);
    await saveShopifyToken(shop, access_token, scope);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const res = NextResponse.redirect(new URL("/shopify-orders", req.nextUrl.origin));
  res.cookies.delete("shopify_oauth_state");
  return res;
}
