import { useState, type FormEvent } from "react"
import { ArrowLeft, BookOpenText, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react"
import { Brand } from "../components/Brand"
import { supabase } from "../lib/supabase"
import { activateRootTestSession } from "../lib/root-test"

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "forgot">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [testPasscode, setTestPasscode] = useState("")
  const [testBusy, setTestBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        if (signInError.message.toLowerCase().includes("invalid login credentials")) {
          throw new Error("Incorrect Seramet account password. Your 4/6-digit POS PIN will not work on this account sign-in.")
        }
        throw signInError
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to authenticate.")
    } finally {
      setBusy(false)
    }
  }

  async function useRootTestAccess(event: FormEvent) {
    event.preventDefault()
    setTestBusy(true)
    setError("")
    setMessage("")
    try {
      await activateRootTestSession(testPasscode)
      window.location.reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Temporary root access failed.")
    } finally {
      setTestBusy(false)
    }
  }

  async function requestReset(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")

    try {
      const redirectTo = `${window.location.origin}/?recovery=1`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (resetError) throw resetError
      setMessage("If this email belongs to a Seramet account, a secure password-reset link has been sent. Open it on this device, set a new password, then the Cookbook will continue automatically.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send the recovery email.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><Brand /></div>
        <div className="auth-icon"><BookOpenText size={24} /></div>

        {mode === "signin" ? (
          <>
            <div className="eyebrow">Seramet kitchen standards</div>
            <h1>Welcome back</h1>
            <p className="subtitle">
              Sign in with your Seramet account email and account password. Cookbook access follows your existing role and branch permissions.
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
                <span>Account password</span>
                <div>
                  <LockKeyhole size={16} />
                  <input
                    type="password"
                    autoComplete="current-password"
                    minLength={10}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your Seramet account password"
                  />
                </div>
              </label>

              <button
                type="button"
                className="auth-text-button"
                onClick={() => {
                  setMode("forgot")
                  setError("")
                  setMessage("")
                }}
              >
                Forgot account password?
              </button>

              {error && <div className="auth-message error">{error}</div>}

              <button type="submit" className="primary-button auth-submit" disabled={busy}>
                {busy && <LoaderCircle className="spin" size={16} />}
                Sign in
              </button>
            </form>

            <div className="info-card" style={{ boxShadow: "none" }}>
              <ShieldCheck size={18} />
              <div>
                <strong>Account password ≠ POS PIN</strong>
                <p>The Cookbook uses your full Seramet account identity. The 4/6-digit employee PIN is restricted to branch-bound POS devices.</p>
              </div>
            </div>

            <div className="auth-divider"><span>Temporary test access</span></div>

            <form className="auth-form" onSubmit={useRootTestAccess}>
              <label className="auth-field">
                <span>Root test passcode</span>
                <div>
                  <KeyRound size={16} />
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={testPasscode}
                    onChange={(event) => setTestPasscode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit test code"
                  />
                </div>
              </label>

              <button type="submit" className="secondary-button auth-submit" disabled={testBusy}>
                {testBusy && <LoaderCircle className="spin" size={16} />}
                Enter test workspace
              </button>
              <p className="auth-test-note">Preview only. This temporary route expires automatically and is not enabled on the production Cookbook.</p>
            </form>
          </>
        ) : (
          <>
            <button
              type="button"
              className="auth-back-button"
              onClick={() => {
                setMode("signin")
                setError("")
                setMessage("")
              }}
            >
              <ArrowLeft size={15} />
              Back to sign in
            </button>

            <div className="eyebrow">Account recovery</div>
            <h1>Reset password</h1>
            <p className="subtitle">
              We’ll send a secure Supabase recovery link to the email on your Seramet account.
            </p>

            <form className="auth-form" onSubmit={requestReset}>
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

              {error && <div className="auth-message error">{error}</div>}
              {message && <div className="auth-message success">{message}</div>}

              <button type="submit" className="primary-button auth-submit" disabled={busy}>
                {busy && <LoaderCircle className="spin" size={16} />}
                Send reset link
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
