import React, { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import Logo from "../ui/Logo";
import Button from "../ui/Button";
import { Container } from "../ui/Layout";

const NAV_LINKS = [
  { to: "/product", label: "Product" },
  { to: "/aviation", label: "Aviation" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/about", label: "About" },
];

export default function CorporateLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="op-shell" data-op-theme="dark">
      <header className="op-shell-header">
        <Container>
          <div className="op-topbar">
            <Logo />

            <nav className="op-nav op-corporate-nav" aria-label="Corporate navigation">
              {NAV_LINKS.map((link) => (
                <Link key={link.to} to={link.to} className="op-nav-link">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="op-row" style={{ justifyContent: "flex-end", gap: "var(--op-space-2)" }}>
              <Button to="/login" variant="secondary">
                Sign in
              </Button>
              <Button to="/demo" variant="primary">
                Explore the demo
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="op-mobile-menu-toggle"
              aria-label="Toggle navigation"
              style={{
                display: "none",
                background: "var(--op-color-surface)",
                border: "1px solid var(--op-color-border-strong)",
                borderRadius: "var(--op-radius-control)",
                color: "var(--op-color-text-primary)",
                padding: "8px 12px",
              }}
            >
              Menu
            </button>
          </div>
        </Container>

        <div className="op-context-bar" role="status" aria-live="polite">
          <Container>
            <div className="op-context-grid">
              <div className="op-context-item">
                <span className="op-context-label">Operating mode</span>
                <span className="op-context-value">Intelligence environment</span>
              </div>
              <div className="op-context-item">
                <span className="op-context-label">Current phase</span>
                <span className="op-context-value">Contract intelligence foundation</span>
              </div>
              <div className="op-context-item">
                <span className="op-context-label">Spatial posture</span>
                <span className="op-context-value">Operational + spatial architecture</span>
              </div>
              <div className="op-context-item">
                <span className="op-context-label">Data integrity</span>
                <span className="op-context-value">No fabricated intelligence data</span>
              </div>
            </div>
          </Container>
        </div>

        {menuOpen && (
          <div className="op-mobile-menu" style={{ borderTop: "1px solid var(--op-color-border)" }}>
            <Container>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--op-space-4)", padding: "var(--op-space-5) 0" }}>
                {NAV_LINKS.map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="op-nav-link">
                    {link.label}
                  </Link>
                ))}
                <Button to="/login" variant="secondary">Sign in</Button>
                <Button to="/demo" variant="primary">Explore the demo</Button>
              </div>
            </Container>
          </div>
        )}
      </header>

      <main className="op-shell-main">
        <Outlet />
      </main>

      <footer className="op-shell-footer">
        <Container>
          <div className="op-row" style={{ flexWrap: "wrap" }}>
            <Logo size="sm" />
            <p className="op-body-sm" style={{ margin: 0 }}>
              © {new Date().getFullYear()} Operion OS. Aviation contract intelligence.
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
