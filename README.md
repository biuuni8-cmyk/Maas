# Maas — Milestone 1

Maas is a real-time, multi-tenant company data platform. This milestone provides the production foundation for the larger roadmap: secure company workspaces, authentication, role-aware membership, products, audits, metrics, dark/light mode, and Supabase realtime.

## This milestone includes

- Next.js App Router + TypeScript
- Supabase Auth and SSR sessions
- PostgreSQL schema and migrations
- Multi-company tenancy with row-level security
- Owner, admin, analyst, and viewer roles
- Company onboarding and workspace creation
- Real product records (no mock/seed data)
- Company metrics and audit data models
- Realtime publication setup
- Responsive light/dark dashboard
- Environment and deployment documentation

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_foundation.sql` in the SQL editor or with Supabase CLI.
3. Copy `.env.example` to `.env.local` and add your keys.
4. Install and run:

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm run build
```

## Roadmap

- Milestone 2: Excel-like editing, bulk import/export, filters, saved views
- Milestone 3: Data cleaning and structuring pipeline
- Milestone 4: Scheduled daily-to-yearly audit engine
- Milestone 5: Analytics, comparisons, reports and drilldowns
- Milestone 6: Enterprise admin, billing readiness, queues and integrations

No production credentials or mock company records are committed.

## Milestone 2 — Excel-like data workspace

Implemented locally (not yet pushed to GitHub):

- Inline editable product grid
- Search, status/category filters and column sorting
- Configurable visible columns
- Saved personal product views
- Multi-row selection and deletion
- CSV import with validation and SKU upsert
- CSV export of the current filtered view
- Import job history schema
- Product change-history audit trail
- Expanded product fields: brand, barcode, cost, stock, unit, description and tags
- Supabase Realtime synchronization

Apply `supabase/migrations/0002_data_workspace.sql` after the foundation migration.


## Milestone 3: Data cleaning and structuring

Maas now includes a real cleaning workflow under `/dashboard/cleaning`: CSV staging, automatic field mapping, reusable normalization rules, validation queues, duplicate review, and approval into the core product dataset. Apply `supabase/migrations/0003_cleaning_engine.sql` after the earlier migrations.

## Milestone 4: Audit Center

The audit center now supports daily through yearly periods, data-quality scoring, issue lifecycle management, period comparisons, review decisions and realtime schedule configuration. Apply `supabase/migrations/0004_audit_center.sql` after earlier migrations.
# Maas
# Maas
