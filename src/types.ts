export type Ingredient = {
  id: string
  name: string
  quantity: string
}

export type Recipe = {
  id: string
  name: string
  category: string
  description: string
  portions: number
  portionSize: string
  prepMinutes: number
  cookMinutes: number
  image: string
  ingredients: Ingredient[]
  method: string[]
  notes?: string
  published: boolean
  version?: number
  recipeVersionId?: string | null
  menuItemId?: string | null
  branchOverrideId?: string | null
  contentRevision?: number
  serametItemId?: string | null
}

export type CookbookWorkspace = {
  id: string
  name: string
  role: "admin" | "editor" | "viewer"
  userId?: string
  userName?: string
  permissions?: string[]
  canManage?: boolean
  canPublish?: boolean
  branches?: Array<{ id: string; name: string; code: string }>
}

export type BackendMode = "local" | "supabase"

export type ImportIssueSeverity = "info" | "review" | "blocked"

export type ImportIssue = {
  code: string
  message: string
  severity: ImportIssueSeverity
}

export type ParsedQuantity = {
  raw: string
  value?: number
  unitCode?: string
  unitLabel?: string
  notes?: string
  approximate?: boolean
  issues: ImportIssue[]
}

export type ParsedIngredientCandidate = {
  id: string
  name: string
  rawQuantity: string
  quantity: ParsedQuantity
}

export type ParsedRecipeCandidate = {
  clientId: string
  name: string
  category: string
  meta: string[]
  yield: ParsedQuantity | null
  ingredients: ParsedIngredientCandidate[]
  method: string[]
  kitchenNotes: string[]
  sourceStatus: "recorded" | "draft" | "validate"
  issues: ImportIssue[]
}

export type IngredientImportMatch = {
  ingredientId: string
  inventoryItemId: string | null
  match: "existing" | "create-candidate"
}

export type RecipeImportPreviewRow = ParsedRecipeCandidate & {
  status: "ready" | "review" | "blocked"
  recipeId: string | null
  menuItemId: string | null
  recipeMatch: "existing-recipe" | "existing-menu" | "new"
  ingredientMatches: IngredientImportMatch[]
}

export type CookbookImportPreview = {
  fileName: string
  fileHash: string
  importerVersion: string
  recipeCount: number
  readyCount: number
  reviewCount: number
  blockedCount: number
  rows: RecipeImportPreviewRow[]
}

export type CookbookImportCommitResult = {
  clientId: string
  name: string
  status: "imported" | "skipped" | "failed"
  recipeId?: string
  recipeVersionId?: string
  message?: string
}

export type CookbookImportCommitReport = {
  fileName: string
  fileHash: string
  selectedCount: number
  importedCount: number
  skippedCount: number
  failedCount: number
  results: CookbookImportCommitResult[]
}

export type PrimaryScreen = "recipes" | "categories" | "import" | "more"
export type Screen = PrimaryScreen | "detail" | "editor"
