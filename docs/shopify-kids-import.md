# Kids Bed catalog import

Reviewed Shopify collection: 318237016235, permanent store 13e79d-01.myshopify.com.
Six models have 106 Shopify variants: Suger Snap 24, Tiny Cloud 32, Tot 1, Mallow 24, Honey Hug 1, Sleepy Bite 24.

SKUs follow GH-BED-MODEL-WIDTH-COLOR-MATTRESS. Models: SUGER, TINY, TOT, MALLOW, HONEY, SLEEPY. Colors: MG mint green, BB baby blue, LB light beige, BE beige, BR brown (Shopify spells it Brwon), GY grey, DB dusty blue, IV ivory, TP taupe, DC dark coffee, NB navy blue, SG sage. NM means without mattress; WM means with mattress. The two single-option drafts use GH-BED-TOT-120 and GH-BED-HONEY-120 without inventing colour or mattress options.

The admin page /products/import-kids previews and imports the reviewed snapshot. Before writing it validates live Shopify identity, currency, product status, variant IDs, titles, SKUs and prices. It makes no Shopify mutations. SKU assignment was separately performed through the Shopify connector with price and status omitted.

Existing Tiny Cloud and Suger Snap family anchors and their generic manufacturing variants remain untouched, including BOMs, costs and historical references. Imported colour/size/mattress options are new child records, with empty BOMs and zero ERP stock; Shopify availability is not treated as manufactured stock. Mallow and Sleepy Bite get new family anchors; Tot and Honey Hug are inactive standalone draft records. There are 108 new ERP records for 106 sellable options. Imported height is 90 cm, explicitly confirmed by the owner. Existing Tiny Cloud production templates still have their previous height; changing those templates and cuts requires separate review.

Persistent links use the existing Setting table: shopify.variant.NUMERIC_ID contains shop, Shopify product/variant IDs, ERP product ID and SKU. shopify.product.NUMERIC_ID records family anchors. Future order import must resolve by variant ID and shop, not by product name. These links do not enable automatic order, inventory or price sync.

An advisory transaction lock serializes imports. Products and links are committed together; case-insensitive SKU conflicts and damaged links stop the transaction. Repeating the operation skips linked variants without overwriting later ERP edits. Product images use this store's Shopify CDN URLs, allowed in Next image configuration. No schema migration or additional credentials are required.

Validation: node --test tests/*.test.cjs; npm run build. Tests cover mapping completeness, idempotency, preservation of existing records, Shopify drift, SKU conflicts, transaction failure, role restrictions, origin checks and stale revisions.
