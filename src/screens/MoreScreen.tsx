import { ChevronRight, CircleUserRound, Cloud, Database, GitBranch, LogOut, ShieldCheck, WifiOff } from "lucide-react"
import type { BackendMode, CookbookWorkspace } from "../types"

export function MoreScreen({
  backendMode,
  workspace,
  email,
  onSignOut,
}: {
  backendMode: BackendMode
  workspace?: CookbookWorkspace | null
  email?: string | null
  onSignOut?: () => void
}) {
  const rows = [
    { icon: CircleUserRound, label: "Kitchen access", meta: workspace ? `${workspace.role} · ${email || "signed in"}` : "Local preview access" },
    { icon: Database, label: "Seramet integration", meta: backendMode === "supabase" ? "Shared Seramet staging backend" : "Local preview" },
    { icon: GitBranch, label: "Recipe history", meta: backendMode === "supabase" ? "Seramet versions + cookbook revisions" : "Available in Seramet mode" },
    { icon: ShieldCheck, label: "Publishing controls", meta: backendMode === "supabase" ? (workspace?.canPublish ? "Your Seramet role can publish" : "View/edit rights follow Seramet roles") : "Local device only" }
  ]

  return (
    <main className="content">
      <div className="page-header">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1>More</h1>
          <p className="subtitle">The cookbook stays simple. Advanced configuration will live in Seramet.</p>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">MS</div>
        <div>
          <strong>{workspace?.name || "Mona Swahili"}</strong>
          <span>{backendMode === "supabase" ? "Seramet shared staging workspace" : "Local development workspace"}</span>
        </div>
      </div>

      <div className={backendMode === "supabase" ? "backend-status online" : "backend-status local"}>
        {backendMode === "supabase" ? <Cloud size={17} /> : <WifiOff size={17} />}
        <div>
          <strong>{backendMode === "supabase" ? "Supabase connected" : "Local mode"}</strong>
          <span>{backendMode === "supabase" ? "Auth, tenant, recipes, ingredients and costing are shared with Seramet." : "Recipes persist on this browser in local mode."}</span>
        </div>
      </div>

      <section className="list-panel">
        {rows.map(({ icon: Icon, label, meta }) => (
          <button type="button" className="list-row" key={label}>
            <span className="list-icon"><Icon size={16} /></span>
            <span className="list-main"><strong>{label}</strong><small>{meta}</small></span>
            <ChevronRight size={17} />
          </button>
        ))}
      </section>

      <div className="info-card">
        <Database size={18} />
        <div>
          <strong>Built for Seramet</strong>
          <p>Seramet remains authoritative for recipe versions, yields, ingredients, inventory and food costing. This app adds the kitchen-friendly method and presentation layer.</p>
        </div>
      </div>

      {backendMode === "supabase" && onSignOut && (
        <button type="button" className="signout-button" onClick={onSignOut}>
          <LogOut size={16} />
          Sign out
        </button>
      )}
    </main>
  )
}
