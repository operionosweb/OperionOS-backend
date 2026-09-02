import React from "react";

export function DemoBadge({ children = "DEMO DATA", tone = "demo" }) {
  return <span className={`od-badge od-badge-${tone}`}>{children}</span>;
}

export function PageHeader({ eyebrow, title, description, actions, children }) {
  return <header className="od-page-header"><div><span className="od-eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}{children}</div>{actions && <div className="od-page-actions">{actions}</div>}</header>;
}

export function GlassCard({ title, eyebrow, action, className = "", children }) {
  return <section className={`od-card ${className}`.trim()}>{(title || eyebrow || action) && <header className="od-card-header"><div>{eyebrow && <span className="od-eyebrow">{eyebrow}</span>}{title && <h2>{title}</h2>}</div>{action}</header>}<div className="od-card-body">{children}</div></section>;
}

export function MetricCard({ icon: Icon, label, value, note, tone = "purple" }) {
  return <article className={`od-metric od-metric-${tone}`}><span className="od-metric-icon"><Icon size={18} /></span><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

export function EmptyState({ title, description, action }) {
  return <div className="od-empty"><span className="od-empty-mark" aria-hidden="true" /><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function RiskBadge({ severity }) {
  return <span className={`od-risk od-risk-${String(severity).toLowerCase()}`}>{severity}</span>;
}

export function Confidence({ value }) {
  const percent = value == null ? null : Math.round(Number(value) * 100);
  return <span className="od-confidence">{percent == null ? "Confidence unavailable" : `${percent}% confidence`}</span>;
}

export function EvidenceCard({ evidence, onOpen }) {
  if (!evidence) return null;
  const content = <><div className="od-evidence-top"><span>Source evidence</span><strong>Page {evidence.page ?? "-"}</strong></div><h3>{evidence.locator || "Source location unavailable"}</h3><p>“{evidence.excerpt || "No excerpt available."}”</p></>;
  return onOpen ? <button type="button" className="od-evidence" onClick={onOpen}>{content}</button> : <article className="od-evidence">{content}</article>;
}

export function SkeletonGrid() {
  return <div className="od-metric-grid" role="status" aria-label="Loading demonstration data">{[1,2,3,4].map((item)=><div className="od-skeleton" key={item}/>)}</div>;
}
