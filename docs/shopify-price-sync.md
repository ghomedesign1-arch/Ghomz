# Manual Shopify price sync

An ADMIN can open Muffin and choose **Sync price to Shopify**. Save the ERP retail price first, review both prices, then confirm. Equal prices require no write. This does not run automatically when an ERP product is saved.

The initial integration is explicitly restricted to ERP product `cmuvdzv1k000087mhwf7uk4w5`, Shopify product `8714227810475`, variant `46363984396459` (80x112), permanent shop `13e79d-01.myshopify.com`, and EGP. Other products must be mapped deliberately before enabling them.

The server uses the existing Shopify client credentials and AUTH_SECRET. The Shopify app needs write_products. Tokens remain server-side; upstream error bodies are never logged or returned. No migration or new environment variable is required.

GET previews the current price and issues a five-minute signed confirmation bound to the admin, ERP product revision, and Shopify product revision. POST checks same-origin JSON, admin access, signature, and fresh prices/revisions before sending only the mapped variant ID and retail price. Expired or changed previews must be refreshed. A matching price is a no-op. There is no automatic retry after an uncertain response. Shopify offers no atomic revision condition for this mutation, so avoid simultaneous Shopify/ERP edits during confirmation.

Updating the base variant price does not publish a draft product, change stock, orders, discounts, or other variants. Market-specific prices can differ.

Validation: `node --test tests/*.test.cjs` covers access controls, signed confirmations, stale revisions, fixed identity/currency/scope checks, payload restriction, no-op behavior, and sanitized failures. `npm run build` validates the production build. Live verification uses the read-only preview; it does not change the store price.
