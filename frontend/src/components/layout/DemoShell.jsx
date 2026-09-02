import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell, Bot, BrainCircuit, CalendarClock, ChevronDown, FileCheck2, FileText,
  Gauge, Menu, Search, Settings, ShieldAlert, Upload, Users, X, Building2,
  Radar, Scale, ListChecks,
} from "lucide-react";
import BrandMark from "../ui/BrandMark";
import OperionAssistant from "../demo/OperionAssistant";
import { DemoDataProvider, useDemoData } from "../../demo/DemoDataProvider";
import { DemoBadge } from "../../demo/DemoUI";

const mainNav = [
  ["/demo/dashboard", "Dashboard", Gauge],
  ["/demo/contracts", "Contracts", FileText],
  ["/demo/upload", "Upload Contract", Upload],
  ["/demo/live-tracking", "Live Tracking", Radar],
  ["/demo/intelligence", "Intelligence", BrainCircuit],
];
const workspaceNav = [
  ["overview", "Overview", Gauge], ["clauses", "Clauses", Scale],
  ["obligations", "Obligations", ListChecks], ["deadlines", "Deadlines", CalendarClock],
  ["risks", "Risks", ShieldAlert], ["evidence", "Evidence", FileCheck2], ["assistant", "Assistant", Bot],
];
const adminNav = [
  ["/demo/organisation", "Organisation", Building2], ["/demo/users", "Users", Users], ["/demo/settings", "Settings", Settings],
];

function NavigationLink({ to, label, icon: Icon, onNavigate, end }) {
  return <NavLink to={to} end={end} onClick={onNavigate} className={({ isActive }) => `od-nav-link${isActive ? " is-active" : ""}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></NavLink>;
}

function DemoShellContent() {
  const location = useLocation();
  const { contracts, budget } = useDemoData();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const contractMatch = location.pathname.match(/^\/demo\/contracts\/([^/]+)/);
  const contractId = contractMatch?.[1];
  const activeContract = contracts.find((item) => item.id === contractId) || contracts[0];
  const workspaceBase = `/demo/contracts/${activeContract.id}`;
  const budgetPercent = Math.round((budget.used / budget.allocated) * 100);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const destinations = [
      ...mainNav.map(([to, label, icon]) => ({ to, label, icon })),
      ...contracts.map((contract) => ({ to: `/demo/contracts/${contract.id}`, label: contract.title, detail: contract.counterparty, icon: FileText })),
    ];
    return needle ? destinations.filter((item) => `${item.label} ${item.detail || ""}`.toLowerCase().includes(needle)) : destinations.slice(0, 7);
  }, [contracts, query]);

  useEffect(() => { setDrawerOpen(false); setPaletteOpen(false); setNotificationsOpen(false); }, [location.pathname]);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === "Escape") { setDrawerOpen(false); setPaletteOpen(false); setNotificationsOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <div className="od-shell">
    <button type="button" className={`od-scrim${drawerOpen ? " is-visible" : ""}`} onClick={() => setDrawerOpen(false)} aria-label="Close navigation" />
    <aside className={`od-sidebar${drawerOpen ? " is-open" : ""}`}>
      <div className="od-brand"><BrandMark to="/demo/dashboard" size="sm" /><button type="button" className="od-icon-button od-mobile-only" onClick={() => setDrawerOpen(false)} aria-label="Close navigation"><X size={19}/></button></div>
      <p className="od-brand-subtitle">Aviation Contract Intelligence</p>
      <DemoBadge>DEMO MODE</DemoBadge>
      <nav className="od-nav" aria-label="Demo navigation">
        <span className="od-nav-label">Main</span>
        {mainNav.map(([to,label,icon]) => <NavigationLink key={to} to={to} label={label} icon={icon} end={to === "/demo/dashboard"} />)}
        <span className="od-nav-label">Contract workspace</span>
        {workspaceNav.map(([section,label,icon]) => <NavigationLink key={section} to={`${workspaceBase}/${section}`} label={label} icon={icon} />)}
        <span className="od-nav-label">Admin</span>
        {adminNav.map(([to,label,icon]) => <NavigationLink key={to} to={to} label={label} icon={icon} />)}
      </nav>
      <div className="od-budget-card">
        <div className="od-budget-title"><span>AI Intelligence Budget</span><DemoBadge tone="neutral">SYNTHETIC</DemoBadge></div>
        <div className="od-budget-chart" style={{ "--budget": `${budgetPercent * 3.6}deg` }}><strong>{100-budgetPercent}%</strong><span>Remaining</span></div>
        <dl><div><dt>Used</dt><dd>{budget.used.toLocaleString()}</dd></div><div><dt>Available</dt><dd>{budget.allocated.toLocaleString()}</dd></div></dl>
      </div>
      <div className="od-sidebar-foot"><span className="od-system-dot" />Demo systems ready<Link to="/app">Production app</Link></div>
    </aside>

    <div className="od-frame">
      <header className="od-topbar">
        <button type="button" className="od-icon-button od-mobile-only" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Menu size={20}/></button>
        <button type="button" className="od-search-trigger" onClick={() => setPaletteOpen(true)}><Search size={16}/><span>Search contracts, clauses, obligations, risks...</span><kbd>Ctrl K</kbd></button>
        <div className="od-top-actions">
          <button type="button" className="od-icon-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Demo notifications"><Bell size={18}/><i>3</i></button>
          <Link to={`${workspaceBase}/assistant`} className="od-ask-button"><Bot size={16}/>Ask Operion</Link>
          <button type="button" className="od-profile"><span>JS</span><div><strong>John Smith</strong><small>Aviation Partners Ltd.</small></div><ChevronDown size={14}/></button>
        </div>
        {notificationsOpen && <div className="od-popover"><DemoBadge>DEMO DATA</DemoBadge><strong>3 prepared intelligence notices</strong><p>Review late-return risk, insurance evidence, and the maintenance-record deadline.</p></div>}
      </header>
      <main className="od-main"><Outlet /></main>
      <nav className="od-bottom-nav" aria-label="Mobile demo navigation">{mainNav.slice(0,5).map(([to,label,Icon]) => <NavLink key={to} to={to} className={({isActive})=>isActive?"is-active":""}><Icon size={19}/><span>{label === "Upload Contract" ? "Upload" : label}</span></NavLink>)}</nav>
    </div>

    {paletteOpen && <div className="od-command-backdrop" role="presentation" onClick={() => setPaletteOpen(false)}><section className="od-command" role="dialog" aria-modal="true" aria-label="Demo command palette" onClick={(event)=>event.stopPropagation()}><label><Search size={18}/><input autoFocus value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search the demonstration environment"/><kbd>ESC</kbd></label><div>{filtered.map(({to,label,detail,icon:Icon})=><Link key={`${to}-${label}`} to={to}><Icon size={17}/><span><strong>{label}</strong>{detail && <small>{detail}</small>}</span></Link>)}</div><footer><DemoBadge>DEMO DATA</DemoBadge><span>Searches prepared demonstration content only.</span></footer></section></div>}
    <OperionAssistant />
  </div>;
}

export default function DemoShell() {
  return <DemoDataProvider><DemoShellContent /></DemoDataProvider>;
}
