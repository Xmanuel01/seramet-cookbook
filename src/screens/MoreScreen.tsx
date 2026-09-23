import { ChevronRight, CircleUserRound, Database, GitBranch, ShieldCheck } from "lucide-react"

const rows = [
  { icon: CircleUserRound, label: "Kitchen access", meta: "Roles and permissions" },
  { icon: Database, label: "Seramet integration", meta: "Backend connection planned" },
  { icon: GitBranch, label: "Recipe history", meta: "Versioning planned" },
  { icon: ShieldCheck, label: "Publishing controls", meta: "Approval workflow planned" }
]

export function MoreScreen() {
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
          <strong>Mona Swahili</strong>
          <span>Westlands Branch · Kitchen workspace</span>
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
          <p>The recipe data model will later connect to items, ingredients, inventory, production and food costing without redesigning the kitchen app.</p>
        </div>
      </div>
    </main>
  )
}
