import { useEffect, useMemo, useState } from "react"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { LoaderCircle, RefreshCw } from "lucide-react"
import { AppShell } from "./components/AppShell"
import { defaultCategories, seedRecipes } from "./data/recipes"
import {
  getCookbookProfile,
  loadLocalRecipes,
  loadRemoteRecipes,
  saveLocalRecipe,
  saveRemoteContent,
} from "./lib/cookbook-repository"
import { isSupabaseConfigured, supabase } from "./lib/supabase"
import { AuthScreen } from "./screens/AuthScreen"
import { CategoriesScreen } from "./screens/CategoriesScreen"
import { ImportScreen } from "./screens/ImportScreen"
import { MoreScreen } from "./screens/MoreScreen"
import { RecipeDetailScreen } from "./screens/RecipeDetailScreen"
import { RecipeEditorScreen } from "./screens/RecipeEditorScreen"
import { ResetPasswordScreen } from "./screens/ResetPasswordScreen"
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
  const [recoveringPassword, setRecoveringPassword] = useState(() => {
    if (typeof window === "undefined") return false
    return window.location.search.includes("recovery=1") || window.location.hash.includes("type=recovery")
  })

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedId),
    [recipes, selectedId],
  )

  const editingRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === editingId),
    [editingId, recipes],
  )

  const categories = useMemo(() => {
    const source = backendMode === "local" && recipes.length === 0 ? defaultCategories : ["All", ...recipes.map((recipe) => recipe.category)]
    return [...new Set(source.filter(Boolean))]
  }, [backendMode, recipes])

  useEffect(() => {
    if (!isSupabaseConfigured) {
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

    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession) => {
      if (!active) return
      if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true)
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
    if (!isSupabaseConfigured || !session?.user || recoveringPassword) return

    let active = true
    setLoading(true)
    setError("")

    async function load() {
      try {
        const [nextWorkspace, remoteRecipes] = await Promise.all([
          getCookbookProfile(),
          loadRemoteRecipes(),
        ])
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
  }, [recoveringPassword, session?.user?.id])

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
    if (backendMode === "supabase") {
      setError("Use Import Cookbook to create reviewed recipes, or create/link the recipe manually in Seramet Cost Control.")
      return
    }
    setEditingId(null)
    setScreen("editor")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function startEditRecipe() {
    if (!selectedRecipe) return
    if (backendMode === "supabase" && !workspace?.canManage) {
      setError("Your Seramet role can view cookbook recipes but cannot edit cookbook content.")
      return
    }
    setEditingId(selectedRecipe.id)
    setScreen("editor")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function saveRecipe(recipe: Recipe) {
    setSaving(true)
    setError("")

    try {
      let saved: Recipe
      if (backendMode === "local") {
        const next = saveLocalRecipe(recipe)
        setRecipes(next)
        saved = recipe
      } else {
        if (!workspace?.canManage) throw new Error("Your Seramet role cannot edit cookbook content.")
        saved = await saveRemoteContent(recipe, Boolean(workspace.canPublish))
        setRecipes((items) =>
          items.map((item) => item.id === saved.id ? saved : item),
        )
      }

      setSelectedId(saved.id)
      setEditingId(null)
      setScreen("detail")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the recipe.")
    } finally {
      setSaving(false)
    }
  }

  async function refreshRemoteRecipes() {
    if (backendMode !== "supabase") return
    const remoteRecipes = await loadRemoteRecipes()
    setRecipes(remoteRecipes)
    setSelectedId((current) => {
      if (remoteRecipes.some((recipe) => recipe.id === current)) return current
      return remoteRecipes[0]?.id || ""
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (isSupabaseConfigured && recoveringPassword && session) {
    return <ResetPasswordScreen onComplete={() => setRecoveringPassword(false)} />
  }

  if (isSupabaseConfigured && !session && !loading) return <AuthScreen />

  if (loading) {
    return (
      <main className="app-loading">
        <div className="loading-mark"><LoaderCircle className="spin" size={24} /></div>
        <strong>Opening cookbook</strong>
        <span>{isSupabaseConfigured ? "Connecting to Seramet…" : "Loading recipes…"}</span>
      </main>
    )
  }

  const branchLabel =
    (workspace?.branches?.length || 0) > 1
      ? "All branches"
      : workspace?.branches?.[0]?.name || workspace?.name || "Mona Swahili"

  return (
    <AppShell screen={screen} onNavigate={navigate} onAdd={startNewRecipe} branchLabel={branchLabel}>
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
          categories={categories}
          onOpen={openRecipe}
          onAdd={startNewRecipe}
        />
      )}

      {screen === "categories" && (
        <CategoriesScreen recipes={recipes} categories={categories} />
      )}

      {screen === "import" && (
        <ImportScreen
          canImport={Boolean(
            workspace?.canManage &&
            workspace?.canPublish &&
            workspace?.permissions?.includes("costcontrol.manage")
          )}
          onImported={refreshRemoteRecipes}
        />
      )}

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
            categories={categories}
            existing={editingRecipe}
            coreLocked={backendMode === "supabase"}
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
