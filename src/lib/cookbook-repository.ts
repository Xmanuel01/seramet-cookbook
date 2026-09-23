import { defaultCategories, seedRecipes } from "../data/recipes"
import type { CookbookWorkspace, Recipe } from "../types"
import { supabase } from "./supabase"

const LOCAL_RECIPES_KEY = "seramet-cookbook:recipes:v1"

type CategoryRow = {
  id: string
  name: string
}

type RecipeRow = {
  id: string
  name: string
  description: string | null
  servings: number
  portion_size: string | null
  prep_minutes: number
  cook_minutes: number
  image_url: string | null
  notes: string | null
  status: "draft" | "published" | "archived"
  category_id: string | null
  version: number
  seramet_item_id: string | null
}

type IngredientRow = {
  id: string
  recipe_id: string
  position: number
  name: string
  quantity_text: string
}

type StepRow = {
  recipe_id: string
  position: number
  instruction: string
}

const gradients = [
  "linear-gradient(135deg, #2e756c 0%, #5d9f7a 48%, #d7b56f 100%)",
  "linear-gradient(135deg, #8a5b34 0%, #ca925d 46%, #50734a 100%)",
  "linear-gradient(135deg, #673127 0%, #a54c34 52%, #cf805c 100%)",
]

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function recipeSnapshot(recipe: Recipe) {
  return {
    name: recipe.name,
    category: recipe.category,
    description: recipe.description,
    portions: recipe.portions,
    portionSize: recipe.portionSize,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    image: recipe.image,
    ingredients: recipe.ingredients.map(({ name, quantity }) => ({ name, quantity })),
    method: [...recipe.method],
    notes: recipe.notes || "",
    published: recipe.published,
    serametItemId: recipe.serametItemId || null,
  }
}

export function loadLocalRecipes(): Recipe[] {
  if (typeof window === "undefined") return seedRecipes
  const raw = window.localStorage.getItem(LOCAL_RECIPES_KEY)
  if (!raw) return seedRecipes

  try {
    const parsed = JSON.parse(raw) as Recipe[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedRecipes
  } catch {
    return seedRecipes
  }
}

export function saveLocalRecipe(recipe: Recipe): Recipe[] {
  const current = loadLocalRecipes()
  const exists = current.some((item) => item.id === recipe.id)
  const next = exists
    ? current.map((item) => item.id === recipe.id ? recipe : item)
    : [recipe, ...current]

  window.localStorage.setItem(LOCAL_RECIPES_KEY, JSON.stringify(next))
  return next
}

async function getWorkspaceName(workspaceId: string) {
  const client = supabase
  if (!client) throw new Error("Supabase is not configured.")

  const { data, error } = await client
    .from("cookbook_workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single()

  if (error) throw error
  return data.name as string
}

async function seedWorkspaceCategories(workspaceId: string) {
  const client = supabase
  if (!client) throw new Error("Supabase is not configured.")

  const rows = defaultCategories
    .filter((name) => name !== "All")
    .map((name, index) => ({
      workspace_id: workspaceId,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      position: index + 1,
    }))

  const { error } = await client
    .from("recipe_categories")
    .upsert(rows, { onConflict: "workspace_id,slug", ignoreDuplicates: true })

  if (error) throw error
}

export async function ensureCookbookWorkspace(userId: string): Promise<CookbookWorkspace> {
  const client = supabase
  if (!client) throw new Error("Supabase is not configured.")

  const { data: membership, error: membershipError } = await client
    .from("cookbook_workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  if (membershipError) throw membershipError

  if (membership) {
    return {
      id: membership.workspace_id as string,
      name: await getWorkspaceName(membership.workspace_id as string),
      role: membership.role as CookbookWorkspace["role"],
    }
  }

  const { data: workspace, error: workspaceError } = await client
    .from("cookbook_workspaces")
    .insert({
      name: "Mona Swahili",
      slug: `mona-swahili-${userId.slice(0, 8)}`,
      created_by: userId,
    })
    .select("id, name")
    .single()

  if (workspaceError) throw workspaceError

  const { error: memberError } = await client
    .from("cookbook_workspace_members")
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: "admin",
    })

  if (memberError) throw memberError

  await seedWorkspaceCategories(workspace.id)

  return {
    id: workspace.id as string,
    name: workspace.name as string,
    role: "admin",
  }
}

export async function loadRemoteRecipes(workspaceId: string): Promise<Recipe[]> {
  const client = supabase
  if (!client) throw new Error("Supabase is not configured.")

  const [
    { data: categories, error: categoryError },
    { data: recipes, error: recipeError },
    { data: ingredients, error: ingredientError },
    { data: steps, error: stepError },
  ] = await Promise.all([
    client.from("recipe_categories").select("id, name").eq("workspace_id", workspaceId),
    client
      .from("recipes")
      .select("id, name, description, servings, portion_size, prep_minutes, cook_minutes, image_url, notes, status, category_id, version, seramet_item_id")
      .eq("workspace_id", workspaceId)
      .neq("status", "archived")
      .order("name"),
    client
      .from("recipe_ingredients")
      .select("id, recipe_id, position, name, quantity_text")
      .eq("workspace_id", workspaceId)
      .order("position"),
    client
      .from("recipe_steps")
      .select("recipe_id, position, instruction")
      .eq("workspace_id", workspaceId)
      .order("position"),
  ])

  if (categoryError) throw categoryError
  if (recipeError) throw recipeError
  if (ingredientError) throw ingredientError
  if (stepError) throw stepError

  const categoryMap = new Map(
    ((categories || []) as CategoryRow[]).map((category) => [category.id, category.name]),
  )

  return ((recipes || []) as RecipeRow[]).map((recipe, index) => ({
    id: recipe.id,
    name: recipe.name,
    category: recipe.category_id ? categoryMap.get(recipe.category_id) || "Main Dishes" : "Main Dishes",
    description: recipe.description || "",
    portions: recipe.servings,
    portionSize: recipe.portion_size || "1 portion",
    prepMinutes: recipe.prep_minutes,
    cookMinutes: recipe.cook_minutes,
    image: recipe.image_url || gradients[index % gradients.length],
    ingredients: ((ingredients || []) as IngredientRow[])
      .filter((item) => item.recipe_id === recipe.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity_text,
      })),
    method: ((steps || []) as StepRow[])
      .filter((item) => item.recipe_id === recipe.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => item.instruction),
    notes: recipe.notes || "",
    published: recipe.status === "published",
    version: recipe.version,
    serametItemId: recipe.seramet_item_id,
  }))
}

async function ensureCategory(workspaceId: string, categoryName: string) {
  const client = supabase
  if (!client) throw new Error("Supabase is not configured.")

  const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const { data: existing, error: findError } = await client
    .from("recipe_categories")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle()

  if (findError) throw findError
  if (existing?.id) return existing.id as string

  const { data, error } = await client
    .from("recipe_categories")
    .insert({
      workspace_id: workspaceId,
      name: categoryName,
      slug,
      position: 999,
    })
    .select("id")
    .single()

  if (error) throw error
  return data.id as string
}

export async function saveRemoteRecipe(
  workspaceId: string,
  userId: string,
  recipe: Recipe,
): Promise<Recipe> {
  const client = supabase
  if (!client) throw new Error("Supabase is not configured.")

  const categoryId = await ensureCategory(workspaceId, recipe.category)
  const nextVersion = Math.max(1, (recipe.version || 0) + (isUuid(recipe.id) ? 1 : 0))
  const basePayload = {
    workspace_id: workspaceId,
    category_id: categoryId,
    name: recipe.name,
    slug: recipe.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    description: recipe.description,
    servings: recipe.portions,
    portion_size: recipe.portionSize,
    prep_minutes: recipe.prepMinutes,
    cook_minutes: recipe.cookMinutes,
    image_url: recipe.image.startsWith("http") ? recipe.image : null,
    notes: recipe.notes || null,
    status: recipe.published ? "published" : "draft",
    version: nextVersion,
    seramet_item_id: recipe.serametItemId || null,
    updated_by: userId,
  }

  let savedRow: { id: string } | null = null

  if (isUuid(recipe.id)) {
    const { data, error } = await client
      .from("recipes")
      .update(basePayload)
      .eq("id", recipe.id)
      .eq("workspace_id", workspaceId)
      .select("id")
      .single()

    if (error) throw error
    savedRow = data
  } else {
    const { data, error } = await client
      .from("recipes")
      .insert({ ...basePayload, created_by: userId })
      .select("id")
      .single()

    if (error) throw error
    savedRow = data
  }

  const recipeId = savedRow.id

  const { error: deleteIngredientsError } = await client
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("workspace_id", workspaceId)

  if (deleteIngredientsError) throw deleteIngredientsError

  const { error: deleteStepsError } = await client
    .from("recipe_steps")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("workspace_id", workspaceId)

  if (deleteStepsError) throw deleteStepsError

  if (recipe.ingredients.length > 0) {
    const { error } = await client.from("recipe_ingredients").insert(
      recipe.ingredients.map((ingredient, index) => ({
        workspace_id: workspaceId,
        recipe_id: recipeId,
        position: index + 1,
        name: ingredient.name,
        quantity_text: ingredient.quantity,
      })),
    )
    if (error) throw error
  }

  if (recipe.method.length > 0) {
    const { error } = await client.from("recipe_steps").insert(
      recipe.method.map((instruction, index) => ({
        workspace_id: workspaceId,
        recipe_id: recipeId,
        position: index + 1,
        instruction,
      })),
    )
    if (error) throw error
  }

  const persisted: Recipe = { ...recipe, id: recipeId, version: nextVersion }

  const { error: versionError } = await client
    .from("recipe_versions")
    .insert({
      workspace_id: workspaceId,
      recipe_id: recipeId,
      version: nextVersion,
      snapshot: recipeSnapshot(persisted),
      changed_by: userId,
      change_summary: isUuid(recipe.id) ? "Recipe updated" : "Recipe created",
    })

  if (versionError) throw versionError

  return persisted
}
