# Shared Seramet backend

Seramet Cookbook uses the existing **Seramet staging** Supabase project rather than owning a second restaurant database.

## Source of truth

Seramet remains authoritative for:

- restaurant/tenant identity
- users, roles and branch scope
- menu items
- recipe identities
- recipe versions and yield
- inventory ingredients and units
- theoretical food cost and production links

The cookbook adds only the kitchen presentation layer linked to an existing Seramet recipe version:

- preparation time
- cooking time
- portion display label
- method steps
- chef/kitchen notes
- recipe image/media
- source-document metadata
- append-only cookbook content revisions

The canonical schema extension lives in `Xmanuel01/seramet-connect` as migration
`0021_cookbook_shared_backend.sql`.

## Browser access

The web app uses only the browser-safe Supabase publishable key.

It does **not** query Seramet core tables directly. Calls go through the authenticated
`cookbook-api` Edge Function. That function:

1. validates the Supabase user session;
2. resolves the user through Seramet `identity_accounts`;
3. resolves the Seramet tenant, roles, permissions and branch scope;
4. requires `cookbook.view`, `cookbook.manage` or `cookbook.publish` as appropriate;
5. reads authoritative Seramet recipe/version/component records server-side;
6. writes only append-only cookbook content revisions.

Secret/service credentials never ship to the browser.

## Local development

By default the repository points to the shared Seramet staging Auth project. Set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to override the target.

The local recipe fallback remains available for development code paths, but production
must use the shared authenticated backend.

## Core-edit boundary

In shared mode the cookbook intentionally does not edit recipe identity, ingredient
quantity, inventory mapping, yield or costing. Those fields are shown read-only and are
managed in Seramet Cost Control. This avoids creating a second source of truth.
