import { useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { LoaderCircle, RefreshCw } from "lucide-react"
import { AppShell } from "./components/AppShell"
import { defaultCategories, seedRecipes } from "./data/recipes"
import {
  ensureCookbookWorkspace,
  loadLocalRecipes,
  loadRemoteRecipes,
  saveLocalRecipe,
  saveRemoteRecipe,
} from "./lib/cookbook-repository"
import { isSupabaseConfigured, supabase } from "./lib/supabase"
import { AuthScreen } from "./screens/AuthScreen"
import { CategoriesScreen } from "./screens/CategoriesScreen"
import { ImportScreen } from "./screens/ImportScreen"
import { MoreScreen } from "./screens/MoreScreen"
import { RecipeDetailScreen } from "./screens/RecipeDetailScreen"
import { RecipeEditorScreen } from "./screens/RecipeEditorScreen"
import { RecipesScreen } from "./screens/RecipesScreen"
import type { BackendMode, CookbookWorkspace, PrimaryScreen, Recipe, Screen } from "./types"

export default function App() {
  const backendMode: BackendMode = isSupabaseConfigured ? "supabase" : "local"
  const [screen, setScreen] = useState<Screen>("recipes")
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [workspace, setWorkspace] = useState<CookbookWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedId),
    [recipes, selectedId],
  )

  const editingRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === editingId),
    [editingId, recipes],
  )

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      const localRecipes = loadLocalRecipes()
      setRecipes(localRecipes)
      setSelectedId(localRecipes[0]?.id || "")
      setLoading(false)
      return
    }

    let active = true

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      if (!nextSession) {
        setWorkspace(null)
        setRecipes([])
        setLoading(false)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user) return

    let active = true
    setLoading(true)
    setError("")

    async function load() {
      try {
        const nextWorkspace = await ensureCookbookWorkspace(session!.user.id)
        const remoteRecipes = await loadRemoteRecipes(nextWorkspace.id)
        if (!active) return

        setWorkspace(nextWorkspace)
        setRecipes(remoteRecipes)
        setSelectedId((current) => {
          if (remoteRecipes.some((recipe) => recipe.id === current)) return current
          return remoteRecipes[0]?.id || ""
        })
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load the cookbook.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [session?.user?.id])

  function navigate(next: PrimaryScreen) {
    setScreen(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function openRecipe(recipe: Recipe) {
    setSelectedId(recipe.id)
    setScreen("detail")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function startNewRecipe() {
    setEditingId(null)
    setScreen("editor")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function startEditRecipe() {
    if (!selectedRecipe) return
    setEditingId(selectedRecipe.id)
    setScreen("editor")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function saveRecipe(recipe: Recipe) {
    setSaving(true)
    setError("")

    try {
      if (backendMode === "local") {
        const next = saveLocalRecipe(recipe)
        setRecipes(next)
        setSelectedId(recipe.id)
      } else {
        if (!workspace || !session?.user) throw new Error("Your cookbook workspace is not ready.")
        const saved = await saveRemoteRecipe(workspace.id, session.user.id, recipe)
        setRecipes((items) => {
          const exists = items.some((item) => item.id === saved.id || item.id === recipe.id)
          if (!exists) return [saved, ...items]
          return items.map((item) => item.id === saved.id || item.id === recipe.id ? saved : item)
        })
        setSelectedId(saved.id)
      }

      setEditingId(null)
      setScreen("detail")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the recipe.")
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  if (isSupabaseConfigured && !session && !loading) return <AuthScreen />

  if (loading) {
    return (
      <main className="app-loading">
        <div className="loading-mark"><LoaderCircle className="spin" size={24} /></div>
        <strong>Opening cookbook</strong>
        <span>{isSupabaseConfigured ? "Connecting to your secure workspace…" : "Loading recipes…"}</span>
      </main>
    )
  }

  return (
    <AppShell screen={screen} onNavigate={navigate} onAdd={startNewRecipe}>
      {error && (
        <div className="global-error">
          <div>
            <strong>Cookbook needs attention</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => window.location.reload()} aria-label="Reload">
            <RefreshCw size={16} />
          </button>
        </div>
      )}

      {screen === "recipes" && (
        <RecipesScreen
          recipes={recipes.length > 0 ? recipes : backendMode === "local" ? seedRecipes : []}
          categories={defaultCategories}
          onOpen={openRecipe}
          onAdd={startNewRecipe}
        />
      )}

      {screen === "categories" && (
        <CategoriesScreen recipes={recipes} categories={defaultCategories} />
      )}

      {screen === "import" && <ImportScreen />}

      {screen === "more" && (
        <MoreScreen
          backendMode={backendMode}
          workspace={workspace}
          email={session?.user.email}
          onSignOut={backendMode === "supabase" ? signOut : undefined}
        />
      )}

      {screen === "detail" && selectedRecipe && (
        <RecipeDetailScreen
          recipe={selectedRecipe}
          onBack={() => setScreen("recipes")}
          onEdit={startEditRecipe}
        />
      )}

      {screen === "editor" && (
        <div className={saving ? "saving-overlay-wrap" : ""}>
          <RecipeEditorScreen
            categories={defaultCategories}
            existing={editingRecipe}
            onCancel={() => setScreen(editingRecipe ? "detail" : "recipes")}
            onSave={saveRecipe}
          />
          {saving && (
            <div className="saving-overlay">
              <LoaderCircle className="spin" size={22} />
              <span>Saving recipe…</span>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
