import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";
import { Brand } from "../components/Brand";
import { supabase } from "../lib/supabase";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        if (signInError.message.toLowerCase().includes("invalid login credentials")) {
          throw new Error(
            "Incorrect email or password.",
          );
        }
        throw signInError;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to authenticate.");
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const redirectTo = `${window.location.origin}/?recovery=1`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetError) throw resetError;
      setMessage(
        "If this account exists, check your email for a reset link.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send the recovery email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <Brand />
        </div>

        {mode === "signin" ? (
          <>
            <h1>Welcome back</h1>
            <p className="subtitle">Sign in to continue</p>

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
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <button
                type="button"
                className="auth-text-button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setMessage("");
                }}
              >
                Forgot password?
              </button>

              {error && (
                <div className="auth-message error" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="primary-button auth-submit" disabled={busy}>
                {busy && <LoaderCircle className="spin" size={16} />}
                Sign in
              </button>
            </form>

          </>
        ) : (
          <>
            <button
              type="button"
              className="auth-back-button"
              onClick={() => {
                setMode("signin");
                setError("");
                setMessage("");
              }}
            >
              <ArrowLeft size={15} />
              Back to sign in
            </button>

            <div className="eyebrow">Account recovery</div>
            <h1>Reset password</h1>
            <p className="subtitle">
              Enter your email to receive a reset link.
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

              {error && (
                <div className="auth-message error" role="alert">
                  {error}
                </div>
              )}
              {message && (
                <div className="auth-message success" role="status">
                  {message}
                </div>
              )}

              <button type="submit" className="primary-button auth-submit" disabled={busy}>
                {busy && <LoaderCircle className="spin" size={16} />}
                Send reset link
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
