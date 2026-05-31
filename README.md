# G-Homz · Production ERP Dashboard

A modern internal cost-management and production-tracking system for **G-Homz**, a premium Egyptian furniture brand specialised in compressed-sponge sofas and modular seating.

The dashboard intelligently connects sponge blocks, fabric, fiber, packaging and manufacturing labor into a single live cost graph — calculate the real per-unit cost of any sofa, chair or bed and see profitability instantly.

## Tech stack

- **Next.js 14** (App Router, RSC, dynamic routes, route groups)
- **TypeScript** strict
- **Tailwind CSS** + **shadcn/ui** primitives
- **Prisma** ORM on **PostgreSQL**
- **NextAuth v5** with credentials + Prisma adapter
- **Recharts** for analytics
- **Framer Motion** for animations
- **@react-pdf/renderer** for PDF cost statements
- **SheetJS (xlsx)** for Excel exports
- **qrcode** for printable product labels
- **next-themes** for dark/light mode
- **Zod** for input validation

## Getting started

### One-command local bootstrap

Requires **Node.js 18+** and **Docker Desktop** running:

```bash
./setup.sh
```

The script starts Postgres in Docker, installs deps, applies the Prisma schema, seeds demo data, and launches the dev server. Re-running it is safe (it skips work that's already done).

Then open [http://localhost:3000](http://localhost:3000) and sign in:

| Email                 | Password      | Role     |
| --------------------- | ------------- | -------- |
| `founder@g-homz.com`  | `changeme123` | ADMIN    |
| `ops@g-homz.com`      | `changeme123` | MANAGER  |

> Change these immediately in any non-local environment.

### Manual setup (no Docker)

If you'd rather use a Postgres install of your own:

```bash
cp .env.example .env                     # set DATABASE_URL + AUTH_SECRET
openssl rand -base64 32                  # paste into AUTH_SECRET
npm install
npm run db:push
npm run db:seed
npm run dev
```

## Project layout

```
src/
├── app/
│   ├── layout.tsx                Root layout (providers, fonts)
│   ├── login/                    Public sign-in page
│   ├── (app)/                    Auth-gated route group
│   │   ├── layout.tsx            Sidebar + topbar; redirects to /login
│   │   ├── page.tsx              Dashboard home
│   │   ├── sponges/              Sponge inventory + /[id] detail page
│   │   ├── products/             Catalog, detail, /[id]/edit BOM editor
│   │   ├── fabrics/              Fabric inventory
│   │   ├── materials/            Fiber & packaging
│   │   ├── production/           Production run ledger
│   │   ├── inventory/            Locked-in value snapshot
│   │   ├── purchases/            Restock history + new-purchase flow
│   │   ├── suppliers/            Vendor directory
│   │   ├── analytics/            Trends + forecast
│   │   └── settings/             Workspace & roles
│   └── api/
│       ├── auth/[...nextauth]/   NextAuth handlers
│       ├── sponges/, fabrics/, materials/, products/   CRUD
│       ├── cost-estimate/        Stateless BOM calculator
│       ├── exports/*.xlsx/       Excel exporters
│       └── products/[id]/        cost / invoice (PDF) / qr (label)
├── auth.ts                       NextAuth config (credentials + Prisma)
├── middleware.ts                 Route protection
├── components/
│   ├── ui/                       shadcn/ui primitives
│   ├── layout/                   Sidebar, topbar, page header
│   ├── dashboard/                KPI cards, charts, cost bars, forecast
│   ├── dialogs/                  Form dialogs (create + edit) + production-run dialog
│   ├── row-actions/              Per-row "…" menus + Add-button wrappers
│   ├── forms/                    Reusable form field wrapper
│   └── editor/                   Inline product BOM editor sections
├── lib/
│   ├── costing.ts                Pure costing engine
│   ├── product-cost.ts           Loads BOM, runs engine
│   ├── dashboard-data.ts         Aggregations for the home page
│   ├── forecast.ts               Weighted moving average
│   ├── excel.ts                  Workbook builder
│   ├── pdf/invoice.tsx           Cost statement PDF template
│   ├── prisma.ts                 Singleton Prisma client
│   ├── validators.ts             Zod schemas for API input
│   └── utils.ts                  cn, formatNumber, pct
└── types/next-auth.d.ts          Session/JWT augmentation
prisma/
├── schema.prisma                 ERP + Auth.js tables
└── seed.ts                       Yellow 26 Soft, Twix Reef, Fluff family + users
```

## The costing engine

All cost math lives in [`src/lib/costing.ts`](src/lib/costing.ts) as pure functions — no DB, no React. Same logic powers the API route `POST /api/cost-estimate`, the product detail page, and the dashboard home aggregations.

### Sponge block cost

```
cost = (W × D × H × density × pricePerDensity) / 1,000,000
```

Example — *Yellow 26 Soft*:

```
240 × 200 × 120 × 26 × 220 / 1,000,000 = 32,947.20 LE
```

### Sponge contribution per product

Each product unit absorbs its volume share of the block, scaled up by the expected waste percentage so leftover scraps are paid for:

```
unitCost = (cutVolume / blockVolume) × blockCost × (1 / (1 - waste%))
```

### Fabric

```
cost = meters × costPerMeter
```

### Bulk materials (fiber, packaging, extras)

Stored in kg, consumed in grams:

```
cost = (grams / 1000) × costPerKg
```

### Manufacturing

Sum of all `ManufacturingCost` lines on the product (labor, sewing, compression, packaging labor, transport, fixed fee, other).

### Final unit cost

```
total = sponge + fabric + fiber + packaging + extras + manufacturing
profit = retailPrice - total
margin = profit / retailPrice
```

## Sample data

Seeded by `pnpm db:seed`:

| Sponge          | Density | Hardness | Dimensions     | Unit cost |
| --------------- | ------- | -------- | -------------- | --------- |
| Yellow 26 Soft  | 26      | Soft     | 240 × 200 × 120 | 32,947 LE |
| Blue 32 Medium  | 32      | Medium   | 240 × 200 × 100 | 36,096 LE |
| Grey 40 Hard    | 40      | Hard     | 200 × 180 × 80  | 29,952 LE |

Products: *Fluff L Shape Sofa*, *Fluff Chair*, *Fluff Ottoman*, *Cloud Kids Bed* — each with its full BOM (sponge cuts, fabric meters, fiber and vaseline grams, manufacturing lines).

## API surface

| Method | Path                          | Purpose                                     |
| ------ | ----------------------------- | ------------------------------------------- |
| GET    | `/api/sponges`                | List sponge blocks                          |
| POST   | `/api/sponges`                | Create sponge (auto-computes `unitCost`)    |
| GET    | `/api/sponges/[id]`           | Read sponge                                 |
| PATCH  | `/api/sponges/[id]`           | Update sponge (recomputes `unitCost`)       |
| DELETE | `/api/sponges/[id]`           | Remove sponge (ADMIN)                       |
| GET    | `/api/fabrics`                | List fabrics                                |
| POST   | `/api/fabrics`                | Create fabric                               |
| GET    | `/api/fabrics/[id]`           | Read fabric                                 |
| PATCH  | `/api/fabrics/[id]`           | Update fabric                               |
| DELETE | `/api/fabrics/[id]`           | Remove fabric (ADMIN)                       |
| GET    | `/api/materials`              | List bulk materials (fiber/packaging/extra) |
| POST   | `/api/materials`              | Create bulk material                        |
| GET    | `/api/materials/[id]`         | Read bulk material                          |
| PATCH  | `/api/materials/[id]`         | Update bulk material                        |
| DELETE | `/api/materials/[id]`         | Remove bulk material (ADMIN)                |
| GET    | `/api/suppliers/[id]`         | Read supplier                               |
| PATCH  | `/api/suppliers/[id]`         | Update supplier                             |
| DELETE | `/api/suppliers/[id]`         | Remove supplier (ADMIN)                     |
| GET    | `/api/products`               | List products                               |
| POST   | `/api/products`               | Create product (BOM via Prisma relations)   |
| GET    | `/api/products/[id]`          | Read product with full BOM                  |
| PATCH  | `/api/products/[id]`          | Update product metadata (ADMIN/MANAGER)     |
| DELETE | `/api/products/[id]`          | Remove product (ADMIN)                      |
| PUT    | `/api/products/[id]/bom`      | Replace full BOM transactionally            |
| GET    | `/api/products/[id]/cost`     | Resolved cost breakdown                     |
| GET    | `/api/products/[id]/invoice`  | PDF cost statement (inline view)            |
| GET    | `/api/products/[id]/qr`       | Printable QR product label (HTML)           |
| POST   | `/api/cost-estimate`          | Stateless cost calculator                   |
| GET    | `/api/exports/products.xlsx`  | Excel — full catalog with cost breakdown    |
| GET    | `/api/exports/sponges.xlsx`   | Excel — sponge inventory                    |
| ALL    | `/api/auth/*`                 | NextAuth handlers (sign-in, sign-out, …)    |
| GET    | `/api/suppliers`              | List suppliers                              |
| POST   | `/api/suppliers`              | Create supplier (ADMIN/MANAGER)             |
| GET    | `/api/production-runs`        | List recent production runs                 |
| POST   | `/api/production-runs`        | Log a run — transactional inventory deduction |
| GET    | `/api/purchases`              | List restock history                        |
| POST   | `/api/purchases`              | Record a purchase — transactional stock increment |

All endpoints validate input via Zod schemas in `src/lib/validators.ts` and write endpoints are guarded by role-based checks in `src/lib/rbac.ts`:

| Role        | Read | Create/update | Delete | Production runs |
| ----------- | :--: | :-----------: | :----: | :-------------: |
| ADMIN       | ✅   | ✅            | ✅     | ✅              |
| MANAGER     | ✅   | ✅            | ❌     | ✅              |
| PRODUCTION  | ✅   | ❌            | ❌     | ✅              |
| VIEWER      | ✅   | ❌            | ❌     | ❌              |

Add buttons are hidden on the UI for users who lack write permission.

## Production runs — the inventory engine

`POST /api/production-runs` is the operational heart of the system. It runs inside a single Prisma transaction:

1. Resolves the product BOM and snapshots unit cost at the moment of the run.
2. For each sponge cut: computes blocks-needed (rounded up), verifies stock, decrements `Sponge.stockBlocks`, and records the wasted volume in `SpongeConsumption.wasteCm3`.
3. Subtracts `meters × quantity` from `Fabric.stockMeters` for each fabric line.
4. Subtracts `(grams × quantity) / 1000` kg from `BulkMaterial.stockKg` for each fiber / packaging / extra line.
5. Increments `Product.stockQty`.
6. Writes a `ProductionLog` plus full `SpongeConsumption` / `FabricConsumption` / `BulkConsumption` ledger rows.

If any single check fails (e.g. not enough sponge blocks), the entire transaction rolls back — no partial inventory state.

The "Start a run" dialog calls `getProductionRunOptions()` on the server to compute **max feasible quantity** per product across all BOM lines and surfaces a per-input "need / have" preview before submission.

## Roadmap

Wired up in this iteration:

- ✅ **Auth & roles** — NextAuth v5 with credentials + Prisma adapter; middleware-guarded `(app)` route group; role-based UI gating.
- ✅ **PDF cost statements** — `GET /api/products/[id]/invoice` with `@react-pdf/renderer`.
- ✅ **Excel exports** — `/api/exports/products.xlsx` and `/api/exports/sponges.xlsx`.
- ✅ **QR product labels** — `GET /api/products/[id]/qr` returns a printable HTML label.
- ✅ **Material usage forecasting** — weighted moving average on the Analytics page.
- ✅ **CRUD dialogs** — create sponges, fabrics, bulk materials, suppliers and products from the UI.
- ✅ **Transactional production runs** — `POST /api/production-runs` deducts sponge / fabric / bulk inventory atomically and writes the consumption ledger.
- ✅ **Inline BOM editor** — `/products/[id]/edit` lets ADMIN/MANAGER add, edit and remove sponge cuts, fabric lines, bulk materials and manufacturing entries, with a live cost preview that recalculates as you type.
- ✅ **Row-level edit & delete** — every sponge, fabric, bulk material and supplier row has a "…" menu with Edit (pre-fills the same dialog used for create) and Delete (confirmation via AlertDialog). Edit is gated to ADMIN/MANAGER, Delete to ADMIN only.
- ✅ **Sponge detail page** — `/sponges/[id]` shows block specs, stock value, products that consume it (with units-per-block calculation), and the last 10 production runs that drew from it.
- ✅ **Purchase orders / restock** — `/purchases` page with a New Purchase dialog. Each line picks Kind (Sponge/Fabric/Bulk) and a resource; on save, `POST /api/purchases` transactionally creates the purchase, writes line items, and bumps inventory.

Still scaffolded but unwired (require external services or larger refactors):

- **Image uploads** — `imageUrl` columns exist; pick Cloudinary / UploadThing / S3 / Vercel Blob.
- **Arabic localization** — add `next-intl`, introduce a `[locale]` route segment, RTL toggle.
- **OAuth providers** — Auth.js is ready; add Google / GitHub / email-magic-link by editing `src/auth.ts`.
- **Barcode (Code-128 / EAN)** — drop in `bwip-js` next to the QR route if you need shelf barcodes.

## License

Proprietary — built for G-Homz.
