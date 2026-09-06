import React, { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Container } from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import Logo from "../components/ui/Logo";
import { useAuth } from "../context/AuthContext";
import { trackEvent } from "../components/analytics/Analytics";

const HERO = "https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=1800&q=82";

export default function Login() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("error");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!auth?.loading && auth?.isAuthenticated) return <Navigate to="/app/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    trackEvent("login_click", { location: "login_form" });

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      setMessageTone("error");
      setMessage("We could not sign you in. Check your details and try again.");
      return;
    }

    const requestedPath = location.state?.from?.pathname;
    const destination = typeof requestedPath === "string" && requestedPath.startsWith("/app/")
      ? `${requestedPath}${location.state?.from?.search || ""}${location.state?.from?.hash || ""}`
      : "/app/dashboard";
    navigate(destination, { replace: true });
  }

  async function handlePasswordReset() {
    setMessage("");
    if (!email) {
      setMessageTone("error");
      setMessage("Enter your business email to request a password reset.");
      return;
    }

    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setResetting(false);
    setMessageTone(error ? "error" : "success");
    setMessage(error ? "We could not send the reset email. Please try again." : "Check your email for a password reset link.");
  }

  return (
    <main className="op-login-page">
      <section className="op-login-hero op-cinematic-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(4, 22, 37, .94), rgba(4, 29, 45, .5)), url(${HERO})` }}>
        <Container><div className="op-login-grid">
          <Reveal className="op-login-copy"><p className="op-sales-label">OPERION / ACCOUNT ACCESS</p><h1>Access Operion.</h1><p>Sign in to access your Operion workspace and continue working with aviation contract intelligence.</p><Button to="/" variant="secondary">Back to Operion</Button></Reveal>
          <Reveal as="form" className="op-login-panel" onSubmit={handleSubmit}>
            <Logo size="sm" />
            <p className="op-sales-label">SECURE WORKSPACE</p>
            <h2>Sign in</h2>
            <label>Business email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <Button type="submit" disabled={submitting || resetting}>{submitting ? "Signing in…" : "Sign in"}</Button>
            <button type="button" className="op-login-reset" onClick={handlePasswordReset} disabled={submitting || resetting}>{resetting ? "Sending reset link…" : "Forgot password?"}</button>
            {message && <p className={`op-login-message is-${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</p>}
            <div className="op-login-demo-path"><p>Evaluating Operion?</p><Button to="/demo" variant="secondary" onClick={() => trackEvent("demo_access_click", { location: "login" })}>Access Demo</Button><Button to="/request-demo" variant="quiet">Request private access</Button></div>
          </Reveal>
        </div></Container>
      </section>
    </main>
  );
}
