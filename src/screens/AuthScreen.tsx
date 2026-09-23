import { useState, type FormEvent } from "react"
import { BookOpenText, LoaderCircle, LockKeyhole, Mail } from "lucide-react"
import { Brand } from "../components/Brand"
import { supabase } from "../lib/supabase"

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return

    setBusy(true)
    setMessage("")
    setError("")

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (!data.session) {
          setMessage("Account created. Check your email to confirm it, then sign in.")
          setMode("signin")
        }
      }
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
        <div className="eyebrow">Kitchen standards</div>
        <h1>{mode === "signin" ? "Welcome back" : "Create your cookbook account"}</h1>
        <p className="subtitle">
          {mode === "signin"
            ? "Sign in to access Mona Swahili recipes and kitchen standards."
            : "Create the first secure workspace for your cookbook."}
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
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
          </label>

          {error && <div className="auth-message error">{error}</div>}
          {message && <div className="auth-message success">{message}</div>}

          <button type="submit" className="primary-button auth-submit" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={16} />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setError("")
            setMessage("")
            setMode((current) => current === "signin" ? "signup" : "signin")
          }}
        >
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  )
}
