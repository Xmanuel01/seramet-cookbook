# Seramet Cookbook

Seramet Cookbook is the mobile-first kitchen companion for Seramet POS. It uses the same visual language and the same restaurant data, while keeping the everyday cooking workflow much simpler than the ERP.

## Current scope

- exact Seramet design tokens and Plus Jakarta Sans typography
- native-feeling mobile bottom navigation
- responsive Seramet desktop shell
- recipe search and category filtering
- recipe detail view with ingredients, method and kitchen notes
- kitchen-method editor
- shared Supabase Auth with Seramet
- Seramet tenant, role and branch authorization
- authoritative Seramet recipe/version/component reads
- append-only cookbook content revisions
- Word cookbook import/review UI foundation
- production CI build checks

## Shared backend

The app shares the existing Seramet staging backend. It does **not** create duplicate cookbook workspaces, recipes, ingredients or costing records.

Seramet owns:

`menu item → recipe → recipe version → ingredients → inventory → costing → production`

Cookbook adds:

`prep/cook time → method → chef notes → kitchen media`

See `docs/BACKEND_SETUP.md`.

## Run locally

```bash
npm install
npm run dev
```

The repository includes the browser-safe staging Supabase configuration as a default. Deployment environments can override it with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Production build

```bash
npm run build
```

The Edge Function source is versioned at `supabase/functions/cookbook-api/index.ts`.
