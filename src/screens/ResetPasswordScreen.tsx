import { useState, type FormEvent } from "react"
import { BookOpenText, CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react"
import { Brand } from "../components/Brand"
import { supabase } from "../lib/supabase"

export function ResetPasswordScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError("")

    if (password.length < 10) {
      setError("Use at least 10 characters for your Seramet account password.")
      return
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.")
      return
    }

    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      window.history.replaceState({}, document.title, window.location.pathname)
      onComplete()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update the password.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><Brand /></div>
        <div className="auth-icon"><BookOpenText size={24} /></div>
        <div className="eyebrow">Secure account recovery</div>
        <h1>Choose a new password</h1>
        <p className="subtitle">
          This changes your Seramet account password. It does not change your employee POS PIN.
        </p>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            <span>New account password</span>
            <div>
              <LockKeyhole size={16} />
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Confirm new password</span>
            <div>
              <CheckCircle2 size={16} />
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </label>

          {error && <div className="auth-message error">{error}</div>}

          <button type="submit" className="primary-button auth-submit" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={16} />}
            Update password
          </button>
        </form>
      </section>
    </main>
  )
}
