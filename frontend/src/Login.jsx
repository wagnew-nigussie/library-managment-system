import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err.message || "Unable to sign in. Check your details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-pane">
        <div className="login-brand">
          <div className="login-mark">L</div>
          <div className="login-brand-copy">
            <strong>LIBRA</strong>
            <span>Library Management System</span>
          </div>
        </div>

        <div className="login-brand-content">
          <span className="login-eyebrow">YOUR LIBRARY WORKSPACE</span>
          <h2>Knowledge<br /><span>starts here.</span></h2>
          <p>
            Manage books, members, institutions and circulation
            in one organized workspace.
          </p>

          <div className="login-book-art" aria-hidden="true">
            <div className="login-art-circle" />
            <div className="login-books">
              <div className="login-book book-a" />
              <div className="login-book book-b" />
              <div className="login-book book-c" />
              <div className="login-book book-d" />
            </div>
            <div className="login-art-card">
              <span className="login-art-check">✓</span>
              <div>
                <strong>Library organized</strong>
                <span>Everything in its place</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-brand-footer">
          <span className="login-secure-dot" />
          Secure access for authorized users
        </div>
      </section>

      <section className="login-form-pane">
        <div className="login-mobile-brand">
          <div className="login-mark">L</div>
          <strong>LIBRA</strong>
        </div>

        <form className="login-form-card" onSubmit={submit}>
          <span className="login-form-eyebrow">ACCOUNT ACCESS</span>
          <h1>Welcome back</h1>
          <p className="login-form-description">
            Enter your account details to continue.
          </p>

          {error && (
            <div className="login-error" role="alert">
              <span className="login-error-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          <label className="login-field">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="login-password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
              <button
                className="login-show-password"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button className="login-submit" type="submit" disabled={loading}>
            <span>{loading ? "Signing in..." : "Sign in"}</span>
            {!loading && <span className="login-submit-arrow">→</span>}
          </button>

          <div className="login-bottom-note">
            <span className="login-lock-icon">⌑</span>
            Your account is protected. Never share your password.
          </div>
        </form>

        <footer className="login-copyright">
          Library Management System
        </footer>
      </section>
    </main>
  );
}
