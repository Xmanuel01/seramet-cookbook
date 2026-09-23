# Seramet Cookbook

Seramet Cookbook is a clean, mobile-first restaurant recipe and kitchen standards application for Mona Swahili. It is developed separately from the main POS while using the same Seramet visual language and an integration-ready data model.

## Current v0.2 scope

- Seramet design tokens and Plus Jakarta Sans typography
- Native-feeling mobile bottom navigation and touch-friendly recipe workflow
- Responsive Seramet-style desktop sidebar
- Recipe search and category filtering
- Recipe detail view with ingredients, method and kitchen notes
- Working multi-step recipe editor
- Local browser persistence when no backend is configured
- Supabase Auth integration layer
- Secure multi-workspace Supabase schema with RLS
- Persistent recipe/category/ingredient/step repository
- Recipe version snapshot support
- Word cookbook import/review interface foundation
- Seramet tenant, branch, item and inventory linkage fields

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` if you have a Supabase project.
3. `npm run dev`

Without Supabase values the app automatically runs in local mode.

## Production build

`npm run build`

## Backend

See `docs/BACKEND_SETUP.md` and `database/schema.sql`.

The live Supabase schema has not yet been applied because no Supabase project is currently connected to this development session.
