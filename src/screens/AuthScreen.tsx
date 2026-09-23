import { useState, type FormEvent } from "react"
import { BookOpenText, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react"
import { Brand } from "../components/Brand"
import { supabase } from "../lib/supabase"

export function AuthScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to authenticate.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><Brand /></div>
        <div className="auth-icon"><BookOpenText size={24} /></div>
        <div className="eyebrow">Seramet kitchen standards</div>
        <h1>Welcome back</h1>
        <p className="subtitle">
          Sign in with the same account linked to your Seramet restaurant. Cookbook access follows your existing Seramet role and branch permissions.
        </p>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            <span>Email</span>
            <div>
              <Mail size={16} />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div>
              <LockKeyhole size={16} />
              <input
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your Seramet password"
              />
            </div>
          </label>

          {error && <div className="auth-message error">{error}</div>}

          <button type="submit" className="primary-button auth-submit" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={16} />}
            Sign in
          </button>
        </form>

        <div className="info-card" style={{ boxShadow: "none" }}>
          <ShieldCheck size={18} />
          <div>
            <strong>One Seramet identity</strong>
            <p>Accounts and access are managed in Seramet. This cookbook does not create a separate user or restaurant workspace.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
