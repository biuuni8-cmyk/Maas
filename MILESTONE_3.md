# Maas Milestone 3 — Data Cleaning & Structuring Engine

Milestone 3 extends the real-time multi-company platform with a controlled staging and approval workflow for raw datasets.

## Delivered

- CSV cleaning jobs with isolated staging rows
- Automatic source-column mapping suggestions
- Editable source-to-Maas field mapping
- Reusable company cleaning rules
- Text normalization, SKU/barcode normalization, number coercion and defaults
- Validation issue generation and review workflow
- Duplicate detection against existing products and within the import
- Duplicate resolution decisions
- Approval workflow that upserts only reviewed, valid records into products
- Cleaning progress counts and job statuses
- Per-company RLS policies on every cleaning table
- Realtime-enabled job, staged-row and issue tables

## Database migration

Apply migrations in order through Supabase CLI:

```bash
supabase db push
```

The new migration is `supabase/migrations/0003_cleaning_engine.sql`.
