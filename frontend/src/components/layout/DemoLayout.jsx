import React from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import Logo from "../ui/Logo";
import Button from "../ui/Button";
import { Container } from "../ui/Layout";
import { useAuth } from "../../context/AuthContext";
import { useOrganization } from "../../context/OrganizationContext";

export default function DemoLayout() {
  const auth = useAuth();
  const { organizationId } = useOrganization();
  const location = useLocation();
  const params = useParams();

  const activeContract = params?.id || "None selected";
  const stageHint = location.pathname.includes("/analysis") ? "Analysis" : "Workspace";
  const isPublicDemo = location.pathname === "/demo" || location.pathname === "/demo/explorer";
  const isCommandCenter = location.pathname === "/demo";
  const isExplorer = location.pathname === "/demo/explorer";

  return (
    <div className="op-shell" data-op-theme="light">
      {!isCommandCenter && !isExplorer && <header className="op-shell-header op-demo-header">
        <Container>
          <div className="op-topbar" style={{ minHeight: 68 }}>
            <div className="op-row" style={{ alignItems: "center", gap: "var(--op-space-5)" }}>
              <Logo />
              <nav className="op-nav op-demo-nav" aria-label="Demo navigation">
                <Link to="/demo" className="op-nav-link">Command Center</Link>
                <Link to="/demo/contracts" className="op-nav-link">Contracts</Link>
                <Link to="/demo/explorer" className="op-nav-link">Contract Explorer</Link>
              </nav>
            </div>

            <div className="op-row op-demo-header-actions" style={{ justifyContent: "flex-end", gap: "var(--op-space-3)" }}>
              <span className="op-badge op-demo-environment-badge">Demo environment</span>
              {auth?.isAuthenticated ? (
                <Button variant="secondary" onClick={auth.logout}>
                  Sign out
                </Button>
              ) : (
                <Button to="/login" variant="secondary">
                  Sign in
                </Button>
              )}
            </div>
          </div>
        </Container>

        {!isPublicDemo && <div className="op-context-bar" role="status" aria-live="polite">
          <Container>
            <div className="op-context-grid">
              <div className="op-context-item">
                <span className="op-context-label">Organization</span>
                <span className="op-context-value">{organizationId || "Not set"}</span>
              </div>
              <div className="op-context-item">
                <span className="op-context-label">Contract</span>
                <span className="op-context-value">{activeContract}</span>
              </div>
              <div className="op-context-item">
                <span className="op-context-label">View mode</span>
                <span className="op-context-value">{stageHint}</span>
              </div>
              <div className="op-context-item">
                <span className="op-context-label">Scenario time</span>
                <span className="op-context-value">Current snapshot</span>
              </div>
            </div>
          </Container>
        </div>}
      </header>}

      <main className="op-shell-main">
        <Outlet />
      </main>
    </div>
  );
}
