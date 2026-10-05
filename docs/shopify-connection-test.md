# Shopify connection test

`GET /api/internal/shopify/connection-test` runs only for an authenticated
NextAuth session with role `ADMIN`, using the existing `requireRole` guard.
Existing middleware redirects signed-out requests to login. The route itself
also enforces authentication and authorization.

Configure these existing server environment variables in Vercel:

- `SHOPIFY_SHOP`: store handle or full `*.myshopify.com` domain
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`

The existing production variables are lowercase (`shopify_shop`,
`shopify_client_id`, `shopify_client_secret`); these are accepted as fallbacks.
Uppercase names take precedence when present.

The route exchanges client credentials for a temporary Shopify access token,
then sends only `query ConnectionTest { shop { name myshopifyDomain } }` to
Admin GraphQL API version `2026-07`. A token is acquired per manual test and
kept only in request memory. There is no token persistence or background sync.
The Shopify app must be installed on the store and eligible for the client
credentials grant.

The route accepts no query or host from the caller, rejects non-Shopify hosts,
disables redirects and caching, and times out each upstream call after 10 seconds.
Responses contain only shop identity or a fixed error message. Raw upstream
errors, credential values and tokens are neither returned nor logged.
No store records or ERP database records are written.

## Verification after deployment

Sign in to the ERP as ADMIN, then open:
`https://ghomz.vercel.app/api/internal/shopify/connection-test`.

Success is HTTP 200 with `ok: true` and the actual Shopify shop name and
`myshopifyDomain`. Shopify can return the original permanent domain when `SHOPIFY_SHOP` is a
branded alias. This is accepted; requests always go to the configured host,
and the returned domain is never used as a credential destination.
For G-HOMZ the confirmed identity is `G-homz`, `13e79d-01.myshopify.com`.
A 503 indicates missing or invalid configuration. A 502 distinguishes failed
Shopify authentication from a failed identity query without disclosing the
upstream response. Non-admin sessions receive 403.

Run local mocked security tests with:
`node --test tests/shopify-connection.test.cjs`.
These tests do not prove live Shopify authentication; only the deployed
endpoint response does.

References:
- https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
- https://shopify.dev/docs/api/admin-graphql/latest/queries/shop
