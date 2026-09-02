import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bot,
  BrainCircuit,
  CalendarClock,
  ChevronDown,
  FileCheck2,
  FileText,
  Gauge,
  Menu,
  Search,
  ShieldAlert,
  Radar,
  Upload,
  X,
} from "lucide-react";
import Logo from "../ui/Logo";
import { useAuth } from "../../context/AuthContext";
import { useOrganization } from "../../context/OrganizationContext";

const PRIMARY_NAV = [
  { to: "/app", label: "Dashboard", icon: Gauge, end: true },
  { to: "/app/contracts", label: "Contracts", icon: FileText },
  { to: "/app/upload", label: "Upload", icon: Upload },
  { to: "/app/live-tracking", label: "Live Tracking", icon: Radar },
  { to: "/app/intelligence", label: "Intelligence", icon: BrainCircuit },
];

const WORKSPACE_NAV = [
  { hash: "clauses", label: "Clauses", icon: FileCheck2 },
  { hash: "obligations", label: "Obligations", icon: FileText },
  { hash: "deadlines", label: "Deadlines", icon: CalendarClock },
  { hash: "risks", label: "Risks", icon: ShieldAlert },
  { hash: "evidence", label: "Evidence", icon: FileCheck2 },
  { hash: "assistant", label: "Assistant", icon: Bot },
];

function NavItem({ to, label, icon: Icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `op-product-nav-link${isActive ? " is-active" : ""}`}
      onClick={onNavigate}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
}

export default function ProductionLayout() {
  const auth = useAuth();
  const { organizationId } = useOrganization();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const contractMatch = location.pathname.match(/^\/app\/contracts\/([^/]+)/);
  const contractPath = contractMatch ? `/app/contracts/${contractMatch[1]}` : "";

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = (event) => event.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  return (
    <div className="op-product-shell" data-op-theme="light">
      <button
        type="button"
        className={`op-product-scrim${mobileOpen ? " is-visible" : ""}`}
        aria-label="Close navigation"
        onClick={() => setMobileOpen(false)}
      />
      <aside className={`op-product-sidebar${mobileOpen ? " is-open" : ""}`}>
        <div className="op-product-brand-row">
          <Logo size="md" />
          <button type="button" className="op-icon-button op-mobile-only" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>
        <p className="op-product-descriptor">Aviation Contract Intelligence</p>

        <nav className="op-product-nav" aria-label="Production navigation">
          <span className="op-product-nav-label">Main</span>
          {PRIMARY_NAV.map((item) => <NavItem key={item.to} {...item} />)}

          {contractPath && (
            <>
              <span className="op-product-nav-label">Contract workspace</span>
              <NavItem to={contractPath} label="Overview" icon={Gauge} end />
              {WORKSPACE_NAV.map(({ hash, label, icon: Icon }) => (
                <a key={hash} href={`${contractPath}#${hash}`} className="op-product-nav-link" onClick={() => setMobileOpen(false)}>
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{label}</span>
                </a>
              ))}
            </>
          )}
        </nav>

        <div className="op-product-sidebar-foot">
          <span>Production mode</span>
          <small>{organizationId ? "Organisation scope verified by API" : "Organisation context required"}</small>
          <Link to="/demo" className="op-demo-boundary-link">Open clearly labelled Demo Mode</Link>
        </div>
      </aside>

      <div className="op-product-frame">
        <header className="op-product-topbar">
          <button type="button" className="op-icon-button op-mobile-only" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu size={21} />
          </button>
          <button type="button" className="op-global-search" onClick={() => setSearchOpen((open) => !open)} aria-expanded={searchOpen}>
            <Search size={17} aria-hidden="true" />
            <span>Search contracts and intelligence</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="op-product-account">
            <span className="op-product-account-avatar">{auth?.user?.email?.slice(0, 1).toUpperCase() || "O"}</span>
            <span className="op-product-account-copy">
              <strong>{auth?.user?.email || "Operion user"}</strong>
              <small>Production</small>
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </header>
        {searchOpen && (
          <div className="op-search-boundary" role="status">
            Cross-contract search is not exposed by the current production API. Use search within Contracts or the active workspace.
          </div>
        )}
        <main className="op-product-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
