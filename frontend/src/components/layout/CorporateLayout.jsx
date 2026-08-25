import React, { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import Logo from "../ui/Logo";
import Button from "../ui/Button";
import { Container } from "../ui/Layout";

const NAV_LINKS = [
  { to: "/platform", label: "Platform" },
  { to: "/industries/aviation", label: "Industries" },
  { to: "/scenarios", label: "Scenarios" },
  { to: "/enterprise", label: "Enterprise" },
  { to: "/about", label: "About" },
];

export default function CorporateLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="op-shell op-corporate-shell" data-op-theme="light">
      <header className="op-shell-header op-corporate-header">
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

            <div className="op-row op-corporate-actions" style={{ justifyContent: "flex-end", gap: "var(--op-space-2)" }}>
              <Button to="/login" variant="secondary">
                Sign in
              </Button>
              <Button to="/demo" variant="primary">
                Request a Demo
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
                <Button to="/demo" variant="primary">Request a Demo</Button>
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
              © {new Date().getFullYear()} Operion. Aviation contract intelligence.
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
