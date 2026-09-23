import { seedRecipes } from "../data/recipes"
import type {
  CookbookImportCommitReport,
  CookbookImportPreview,
  CookbookWorkspace,
  ParsedRecipeCandidate,
  Recipe,
} from "../types"
import { supabase } from "./supabase"
import { getRootTestPasscode } from "./root-test"

const LOCAL_RECIPES_KEY = "seramet-cookbook:recipes:v2"

type GatewayResponse<T> = {
  ok: boolean
  data?: T
  error?: string
}

async function invoke<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const rootPasscode = getRootTestPasscode()
  const { data, error } = await supabase.functions.invoke(rootPasscode ? "cookbook-api-test" : "cookbook-api", {
    ...(rootPasscode ? { headers: { "x-cookbook-test-passcode": rootPasscode } } : {}),
    body: { action, ...payload },
  })

  if (error) throw new Error(error.message || "Cookbook service request failed.")

  const response = data as GatewayResponse<T>
  if (!response?.ok) throw new Error(response?.error || "Cookbook service request failed.")
  if (response.data === undefined) throw new Error("Cookbook service returned no data.")
  return response.data
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

export async function getCookbookProfile(): Promise<CookbookWorkspace> {
  return invoke<CookbookWorkspace>("profile")
}

export async function loadRemoteRecipes(): Promise<Recipe[]> {
  return invoke<Recipe[]>("listRecipes")
}

export async function loadRemoteRecipe(recipeId: string): Promise<Recipe> {
  return invoke<Recipe>("getRecipe", { recipeId })
}

export async function saveRemoteContent(
  recipe: Recipe,
  publish = true,
): Promise<Recipe> {
  if (!recipe.recipeVersionId) {
    throw new Error("This Seramet recipe does not have an active version yet.")
  }

  return invoke<Recipe>(publish ? "publishContent" : "saveContent", {
    recipeId: recipe.id,
    recipeVersionId: recipe.recipeVersionId,
    content: {
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      portionLabel: recipe.portionSize,
      imageUrl: recipe.image.startsWith("http") ? recipe.image : null,
      chefNotes: recipe.notes || "",
      method: recipe.method,
      media: [],
      changeSummary: publish ? "Cookbook content published" : "Cookbook content saved as draft",
    },
  })
}

export type CookbookImportInput = {
  fileName: string
  fileHash: string
  importerVersion: string
  recipes: ParsedRecipeCandidate[]
}

export async function previewCookbookImport(input: CookbookImportInput): Promise<CookbookImportPreview> {
  return invoke<CookbookImportPreview>("previewImport", input)
}

export async function commitCookbookImport(
  input: CookbookImportInput,
  selectedClientIds: string[],
): Promise<CookbookImportCommitReport> {
  return invoke<CookbookImportCommitReport>("commitImport", {
    ...input,
    selectedClientIds,
  })
}
