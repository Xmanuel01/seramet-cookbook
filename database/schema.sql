-- Seramet Cookbook core schema
-- Intended for Supabase Postgres.
-- Apply through a controlled migration workflow once the target Supabase project is connected.

create extension if not exists pgcrypto;

create table if not exists public.cookbook_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  seramet_tenant_id text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cookbook_workspace_members (
  workspace_id uuid not null references public.cookbook_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.recipe_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cookbook_workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cookbook_workspaces(id) on delete cascade,
  category_id uuid references public.recipe_categories(id) on delete set null,
  seramet_item_id text,
  seramet_branch_id text,
  name text not null,
  slug text not null,
  description text,
  servings integer not null default 1 check (servings > 0),
  portion_size text,
  prep_minutes integer not null default 0 check (prep_minutes >= 0),
  cook_minutes integer not null default 0 check (cook_minutes >= 0),
  image_url text,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cookbook_workspaces(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null default 0,
  name text not null,
  quantity_text text not null,
  seramet_inventory_item_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cookbook_workspaces(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null default 0,
  instruction text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cookbook_workspaces(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  change_summary text,
  changed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (recipe_id, version)
);

create index if not exists recipes_workspace_idx on public.recipes(workspace_id);
create index if not exists recipes_category_idx on public.recipes(category_id);
create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id, position);
create index if not exists recipe_steps_recipe_idx on public.recipe_steps(recipe_id, position);
create index if not exists recipe_versions_recipe_idx on public.recipe_versions(recipe_id, version desc);
create index if not exists workspace_members_user_idx on public.cookbook_workspace_members(user_id);

alter table public.cookbook_workspaces enable row level security;
alter table public.cookbook_workspace_members enable row level security;
alter table public.recipe_categories enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.recipe_versions enable row level security;

grant select, insert, update, delete on public.cookbook_workspaces to authenticated;
grant select, insert, update, delete on public.cookbook_workspace_members to authenticated;
grant select, insert, update, delete on public.recipe_categories to authenticated;
grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;
grant select, insert, update, delete on public.recipe_steps to authenticated;
grant select, insert on public.recipe_versions to authenticated;

create policy "workspace owners can create workspaces"
on public.cookbook_workspaces
for insert
to authenticated
with check ((select auth.uid()) = created_by);

create policy "members can view workspaces"
on public.cookbook_workspaces
for select
to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1
    from public.cookbook_workspace_members member
    where member.workspace_id = cookbook_workspaces.id
      and member.user_id = (select auth.uid())
  )
);

create policy "admins can update workspaces"
on public.cookbook_workspaces
for update
to authenticated
using (
  exists (
    select 1
    from public.cookbook_workspace_members member
    where member.workspace_id = cookbook_workspaces.id
      and member.user_id = (select auth.uid())
      and member.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.cookbook_workspace_members member
    where member.workspace_id = cookbook_workspaces.id
      and member.user_id = (select auth.uid())
      and member.role = 'admin'
  )
);

create policy "users can view own memberships"
on public.cookbook_workspace_members
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "workspace creators can bootstrap membership"
on public.cookbook_workspace_members
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.cookbook_workspaces workspace
    where workspace.id = cookbook_workspace_members.workspace_id
      and workspace.created_by = (select auth.uid())
  )
);

create policy "members can view recipe categories"
on public.recipe_categories
for select
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_categories.workspace_id
      and member.user_id = (select auth.uid())
  )
);

create policy "editors can create recipe categories"
on public.recipe_categories
for insert
to authenticated
with check (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_categories.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);

create policy "editors can update recipe categories"
on public.recipe_categories
for update
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_categories.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_categories.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);

create policy "members can view recipes"
on public.recipes
for select
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipes.workspace_id
      and member.user_id = (select auth.uid())
  )
);

create policy "editors can create recipes"
on public.recipes
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipes.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);

create policy "editors can update recipes"
on public.recipes
for update
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipes.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipes.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);

create policy "editors can archive recipes"
on public.recipes
for delete
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipes.workspace_id
      and member.user_id = (select auth.uid())
      and member.role = 'admin'
  )
);

create policy "members can view ingredients"
on public.recipe_ingredients
for select
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_ingredients.workspace_id
      and member.user_id = (select auth.uid())
  )
);

create policy "editors can create ingredients"
on public.recipe_ingredients
for insert
to authenticated
with check (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_ingredients.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);

create policy "editors can update ingredients"
on public.recipe_ingredients
for update
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_ingredients.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_ingredients.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);

create policy "editors can delete ingredients"
on public.recipe_ingredients
for delete
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_ingredients.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);

create policy "members can view steps"
on public.recipe_steps
for select
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_steps.workspace_id
      and member.user_id = (select auth.uid())
  )
);

create policy "editors can create steps"
on public.recipe_steps
for insert
to authenticated
with check (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_steps.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);

create policy "editors can update steps"
on public.recipe_steps
for update
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_steps.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_steps.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);

create policy "editors can delete steps"
on public.recipe_steps
for delete
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_steps.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);

create policy "members can view recipe history"
on public.recipe_versions
for select
to authenticated
using (
  exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_versions.workspace_id
      and member.user_id = (select auth.uid())
  )
);

create policy "editors can create recipe history"
on public.recipe_versions
for insert
to authenticated
with check (
  changed_by = (select auth.uid())
  and exists (
    select 1 from public.cookbook_workspace_members member
    where member.workspace_id = recipe_versions.workspace_id
      and member.user_id = (select auth.uid())
      and member.role in ('admin', 'editor')
  )
);
