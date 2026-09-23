# Backend setup

The application now supports two modes:

1. **Local mode** — active when no Supabase environment variables are present. Recipes persist in the browser with localStorage.
2. **Supabase mode** — active when both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured.

## Supabase project

No Supabase project is currently connected to the development session, so the database schema has intentionally **not** been applied to a live project.

When a project is connected:

1. Review `database/schema.sql`.
2. Apply it through the Supabase migration workflow.
3. Run Supabase security and performance advisors.
4. Generate TypeScript database types and commit them.
5. Add the project URL and publishable key to the deployment environment.
6. Test sign-up, sign-in, first-workspace bootstrap, recipe create, recipe edit and recipe history.

## Security decisions

- Only the browser-safe publishable key belongs in the frontend.
- No service-role or secret key is used by the application.
- Every exposed cookbook table has Row Level Security enabled.
- Table privileges are explicitly granted to `authenticated` because new Supabase projects no longer automatically expose newly-created public tables to the Data API.
- Workspace membership is checked in recipe/category/ingredient/step/version policies.
- Authorization does not use user-editable user metadata.

## Seramet integration fields

The schema already reserves:

- `cookbook_workspaces.seramet_tenant_id`
- `recipes.seramet_item_id`
- `recipes.seramet_branch_id`
- `recipe_ingredients.seramet_inventory_item_id`

These fields let the cookbook become a Seramet module later without forcing kitchen staff to use the full ERP interface.
