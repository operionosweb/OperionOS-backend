import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Section, Container } from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import Logo from "../components/ui/Logo";

const HERO = "https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=1800&q=82";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const action =
      mode === "signup"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });

    const { error } = await action;
    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = "/demo";
  }

  return (
    <>
      <section className="op-page-hero op-cinematic-hero" style={{ backgroundImage: `url(${HERO})` }}>
        <div className="op-page-hero-overlay">
          <Container>
            <Reveal>
              <p className="op-stitch-label">OPERION / ACCOUNT ACCESS</p>
              <h1>{mode === "login" ? "Sign in to Operion" : "Create an account"}</h1>
              <p>Access the contract intelligence workspace and continue from the beginning of the journey.</p>
            </Reveal>
          </Container>
        </div>
      </section>

      <Section>
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          <Reveal>
            <div style={{ marginBottom: "var(--op-space-4)" }}>
              <Logo />
            </div>
            <p className="op-eyebrow">Operion</p>
            <h1 className="op-heading-lg" style={{ marginBottom: "var(--op-space-6)" }}>
              {mode === "login" ? "Sign in to Operion" : "Create an account"}
            </h1>
          </Reveal>

          <Reveal as="form" onSubmit={handleSubmit} style={{ display: "grid", gap: "var(--op-space-3)" }}>
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="op-surface"
              style={{ padding: "12px 16px", color: "var(--op-text)", background: "transparent", border: "1px solid var(--op-border)" }}
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="op-surface"
              style={{ padding: "12px 16px", color: "var(--op-text)", background: "transparent", border: "1px solid var(--op-border)" }}
            />

            <Button type="submit" variant="primary" onClick={undefined}>
              {submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
            </Button>

            {message && (
              <p className="op-body" style={{ color: "var(--op-signal-risk)" }}>
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              style={{ background: "none", border: "none", color: "var(--op-text-muted)", cursor: "pointer", textAlign: "left" }}
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>

            <div className="op-login-demo-path">
              <p className="op-kicker">New visitors</p>
              <h2 className="op-heading-md" style={{ margin: "var(--op-space-2) 0" }}>Explore Operion first</h2>
              <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
                See Contract Intelligence in action using a controlled demonstration environment.
              </p>
              <Button to="/demo" variant="secondary">Explore the Demo</Button>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
