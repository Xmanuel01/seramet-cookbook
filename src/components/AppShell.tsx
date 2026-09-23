import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { BookOpenText, FileUp, LayoutGrid, Plus, Settings2 } from "lucide-react"
import { Brand } from "./Brand"
import type { PrimaryScreen, Screen } from "../types"

const navItems: Array<{ id: PrimaryScreen; label: string; icon: LucideIcon }> = [
  { id: "recipes", label: "Recipes", icon: BookOpenText },
  { id: "categories", label: "Categories", icon: LayoutGrid },
  { id: "import", label: "Import", icon: FileUp },
  { id: "more", label: "More", icon: Settings2 }
]

function activePrimary(screen: Screen): PrimaryScreen {
  if (screen === "detail" || screen === "editor") return "recipes"
  return screen
}

export function AppShell({
  screen,
  onNavigate,
  onAdd,
  children
}: {
  screen: Screen
  onNavigate: (screen: PrimaryScreen) => void
  onAdd: () => void
  children: ReactNode
}) {
  const active = activePrimary(screen)

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Brand />
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={active === id ? "desktop-nav-button active" : "desktop-nav-button"}
              onClick={() => onNavigate(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-workspace">
          <span>Workspace</span>
          <strong>Westlands Branch</strong>
          <small>Kitchen standards</small>
        </div>
      </aside>

      <section className="app-stage">
        <header className="mobile-topbar">
          <Brand />
          <div className="branch-pill">
            <span className="branch-dot" />
            Westlands
          </div>
        </header>
        {children}
      </section>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={active === id ? "active" : ""}
            onClick={() => onNavigate(id)}
          >
            <Icon size={19} strokeWidth={2.2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {active === "recipes" && screen !== "editor" && (
        <button type="button" className="fab" onClick={onAdd} aria-label="Add recipe">
          <Plus size={23} />
        </button>
      )}
    </div>
  )
}
