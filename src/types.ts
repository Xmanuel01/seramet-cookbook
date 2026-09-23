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

export type PrimaryScreen = "recipes" | "categories" | "import" | "more"
export type Screen = PrimaryScreen | "detail" | "editor"
