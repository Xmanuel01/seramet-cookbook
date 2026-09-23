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
  serametItemId?: string | null
}

export type CookbookWorkspace = {
  id: string
  name: string
  role: "admin" | "editor" | "viewer"
}

export type BackendMode = "local" | "supabase"

export type PrimaryScreen = "recipes" | "categories" | "import" | "more"
export type Screen = PrimaryScreen | "detail" | "editor"
