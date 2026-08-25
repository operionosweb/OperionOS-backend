import React, { useEffect, useMemo, useState } from "react";
import { Section } from "../components/ui/Layout";
import Reveal from "../components/ui/Reveal";
import Button from "../components/ui/Button";
import { EmptyState } from "../components/ui/States";
import SpatialModeToggle from "../components/intelligence/spatial/SpatialModeToggle";
import SpatialTransition from "../components/intelligence/spatial/SpatialTransition";
import { PUBLIC_DEMO_CONTRACTS, PUBLIC_DEMO_NOTICE } from "../lib/publicDemoData";

function SampleBadge({ children, live = false }) {
  return <span className={live ? "op-badge op-badge-live" : "op-badge op-badge-future"}>{children}</span>;
}

function DemoSeo() {
  useEffect(() => {
    const title = "Operion Demo | Explore Contract Intelligence";
    const description = "Explore Operion's Contract Intelligence capabilities through a controlled demonstration environment for understanding clauses, obligations, risks and contractual exposure.";
    const canonicalUrl = "https://operionos.com/demo";
    const previousTitle = document.title;
    document.title = title;
    const metadata = [
      ["name", "description", description],
      ["property", "og:title", title],
      ["property", "og:description", description],
      ["property", "og:type", "website"],
      ["property", "og:url", canonicalUrl],
      ["name", "twitter:title", title],
      ["name", "twitter:description", description],
    ];
    const changed = metadata.map(([attribute, key, content]) => {
      let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
      const isNew = !tag;
      const previousContent = tag?.getAttribute("content");
      if (isNew) {
        tag = document.createElement("meta");
        tag.setAttribute(attribute, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
      return { tag, isNew, previousContent };
    });
    let canonical = document.head.querySelector('link[rel="canonical"]');
    const canonicalIsNew = !canonical;
    const previousCanonical = canonical?.getAttribute("href");
    if (canonicalIsNew) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
    return () => {
      document.title = previousTitle;
      changed.forEach(({ tag, isNew, previousContent }) => {
        if (isNew) tag.remove();
        else tag.setAttribute("content", previousContent || "");
      });
      if (canonicalIsNew) canonical.remove();
      else canonical.setAttribute("href", previousCanonical || "");
    };
  }, []);
  return null;
}

export default function DemoHub() {
  const [mode, setMode] = useState("standard");
  const [selectedContractId, setSelectedContractId] = useState(PUBLIC_DEMO_CONTRACTS[0].id);
  const [selectedClauseId, setSelectedClauseId] = useState(PUBLIC_DEMO_CONTRACTS[0].clauses[0].id);
  const [query, setQuery] = useState("");

  const contract = PUBLIC_DEMO_CONTRACTS.find((item) => item.id === selectedContractId) || PUBLIC_DEMO_CONTRACTS[0];
  const selectedClause = contract.clauses.find((item) => item.id === selectedClauseId) || contract.clauses[0];
  const visibleClauses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return contract.clauses;
    return contract.clauses.filter((clause) => `${clause.number} ${clause.title} ${clause.category} ${clause.sourceText}`.toLowerCase().includes(normalizedQuery));
  }, [contract, query]);
  const visibleObligations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return contract.obligations;
    return contract.obligations.filter((obligation) => `${obligation.description} ${obligation.responsibleParty} ${obligation.status}`.toLowerCase().includes(normalizedQuery));
  }, [contract, query]);

  function selectContract(nextContract) {
    setSelectedContractId(nextContract.id);
    setSelectedClauseId(nextContract.clauses[0].id);
    setQuery("");
  }

  return (
    <Section>
      <DemoSeo />
      <Reveal>
        <p className="op-eyebrow">Demo Environment</p>
        <h1 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)", maxWidth: 860 }}>Explore Operion Contract Intelligence</h1>
        <p className="op-body-lg" style={{ marginBottom: "var(--op-space-3)" }}>Explore how Operion turns contracts into structured intelligence — from clauses and obligations to potential risks, financial exposure and future decision support.</p>
        <p className="op-body-sm" style={{ marginBottom: "var(--op-space-6)" }}>{PUBLIC_DEMO_NOTICE}</p>
        <SpatialModeToggle mode={mode} onChange={setMode} />
      </Reveal>

      <Reveal className="op-demo-orientation" style={{ marginTop: "var(--op-space-6)" }}>
        <div><span className="op-kicker">Step 1</span><strong>Select a demonstration contract</strong></div>
        <div><span className="op-kicker">Step 2</span><strong>Explore Contract Intelligence</strong></div>
        <div><span className="op-kicker">Step 3</span><strong>Inspect clauses and obligations</strong></div>
        <div><span className="op-kicker">Step 4</span><strong>Explore potential consequences</strong></div>
      </Reveal>

      <Reveal className="op-demo-workspace" style={{ marginTop: "var(--op-space-6)" }}>
        <div className="op-demo-contract-rail">
          <div><p className="op-kicker">Prepared sample contracts</p><p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>Fictional aviation agreements for demonstration only.</p></div>
          <div className="op-demo-contract-list">
            {PUBLIC_DEMO_CONTRACTS.map((item) => <button key={item.id} type="button" className={selectedContractId === item.id ? "op-demo-contract-button op-demo-contract-button-active" : "op-demo-contract-button"} onClick={() => selectContract(item)}><span className="op-kicker">{item.type}</span><strong>{item.title}</strong><span className="op-body-sm">{item.counterparty}</span></button>)}
          </div>
        </div>

        <div className="op-demo-main">
          <div className="op-demo-contract-header">
            <div><SampleBadge live>Contract Intelligence</SampleBadge><h2 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>{contract.title}</h2><p className="op-body-sm">{contract.description}</p></div>
            <div className="op-demo-contract-meta"><div><span className="op-kicker">Type</span><strong>{contract.type}</strong></div><div><span className="op-kicker">Counterparty</span><strong>{contract.counterparty}</strong></div><div><span className="op-kicker">Status</span><strong>{contract.status}</strong></div></div>
          </div>
          <div className="op-demo-search"><label className="op-kicker" htmlFor="demo-contract-search">Search this sample contract</label><input id="demo-contract-search" className="op-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clauses, obligations or source text" /></div>
          {mode === "standard" ? <SpatialTransition kind="enter"><DemoStandardView contract={contract} clauses={visibleClauses} obligations={visibleObligations} selectedClause={selectedClause} onSelectClause={setSelectedClauseId} /></SpatialTransition> : <SpatialTransition kind="navigate"><DemoSpatialView contract={contract} clauses={visibleClauses} obligations={visibleObligations} selectedClause={selectedClause} onSelectClause={setSelectedClauseId} /></SpatialTransition>}
        </div>
      </Reveal>

      <Reveal className="op-demo-preview-grid" style={{ marginTop: "var(--op-space-6)" }}>
        <div className="op-surface" style={{ padding: "var(--op-space-5)" }}><SampleBadge>Financial Intelligence — In Development</SampleBadge><h2 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>Potential financial exposure</h2><p className="op-body-sm">A future intelligence layer could connect contractual mechanisms to financial exposure. No financial value is calculated in this public demo.</p></div>
        <div className="op-surface" style={{ padding: "var(--op-space-5)" }}><SampleBadge>Contract Comparison — In Development</SampleBadge><h2 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>Compare what matters</h2><p className="op-body-sm">A future comparison experience could highlight differences in service levels, obligations, penalties and termination structures.</p></div>
        <div className="op-surface" style={{ padding: "var(--op-space-5)" }}><SampleBadge>AI Assistant — In Development</SampleBadge><h2 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>Ask questions naturally</h2><p className="op-body-sm">Examples: “Which obligations are due soon?” or “Which clauses create financial exposure?” No generated answers are shown in this controlled demo.</p></div>
      </Reveal>

      <Reveal className="op-demo-future" style={{ marginTop: "var(--op-space-6)" }}><SampleBadge>Illustrative scenario</SampleBadge><h2 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>Where Contract Intelligence could go next</h2><div className="op-demo-future-flow"><span>Weather disruption</span><b aria-hidden="true">→</b><span>Operational delay</span><b aria-hidden="true">→</b><span>Affected contract</span><b aria-hidden="true">→</b><span>Relevant clause</span><b aria-hidden="true">→</b><span>Potential consequence</span><b aria-hidden="true">→</b><span>Mitigation concept</span></div><p className="op-body-sm" style={{ marginTop: "var(--op-space-4)" }}>Illustrative future direction only. This demo does not track live weather, flights, suppliers or customer data.</p></Reveal>
      <Reveal className="op-demo-cta" style={{ marginTop: "var(--op-space-6)" }}><h2 className="op-heading-md">Want to see this with your contracts?</h2><p className="op-body-lg" style={{ margin: "var(--op-space-3) auto var(--op-space-5)" }}>Operion's public Demo uses prepared demonstration data. For a deeper evaluation, we can explore your contracts, operational context and specific aviation use cases.</p><div className="op-row" style={{ justifyContent: "center", flexWrap: "wrap" }}><Button to="/demo" variant="primary">Request a Demo</Button><Button to="/industries/aviation" variant="secondary">Explore Aviation Intelligence</Button></div></Reveal>
    </Section>
  );
}

function DemoStandardView({ contract, clauses, obligations, selectedClause, onSelectClause }) {
  return <div className="op-demo-results"><div className="op-demo-section"><div className="op-row" style={{ justifyContent: "space-between" }}><div><p className="op-kicker">Clause Intelligence</p><h2 className="op-heading-md" style={{ marginTop: "var(--op-space-2)" }}>Rules identified in this contract</h2></div><SampleBadge live>{clauses.length} prepared records</SampleBadge></div>{clauses.length ? <div className="op-demo-clause-list">{clauses.map((clause) => <button key={clause.id} type="button" className={selectedClause?.id === clause.id ? "op-demo-clause-button op-demo-clause-button-active" : "op-demo-clause-button"} onClick={() => onSelectClause(clause.id)}><span className="op-kicker">{clause.number}</span><strong>{clause.title}</strong><span className="op-body-sm">{clause.category}</span></button>)}</div> : <EmptyState title="No matching clauses" description="No prepared clause matches this search." />}</div><ClauseInspector clause={selectedClause} /><div className="op-demo-section"><div className="op-row" style={{ justifyContent: "space-between" }}><div><p className="op-kicker">Obligations Tracker</p><h2 className="op-heading-md" style={{ marginTop: "var(--op-space-2)" }}>Commitments connected to the contract</h2></div><SampleBadge live>{obligations.length} prepared records</SampleBadge></div>{obligations.length ? <div className="op-demo-obligation-list">{obligations.map((obligation) => <div key={obligation.id} className="op-demo-obligation"><strong>{obligation.description}</strong><span><b>Responsible party</b>{obligation.responsibleParty}</span><span><b>Deadline</b>{obligation.deadline}</span><span><b>Status</b>{obligation.status}</span><span><b>Related clause</b>{obligation.clauseId}</span><p className="op-body-sm"><b>Potential consequence</b> {obligation.consequence}</p></div>)}</div> : <EmptyState title="No matching obligations" description="No prepared obligation matches this search." />}</div></div>;
}

function DemoSpatialView({ contract, clauses, obligations, selectedClause, onSelectClause }) {
  return <div className="op-demo-spatial-view"><div className="op-demo-spatial-map"><p className="op-kicker">Spatial contract context</p><div className="op-demo-spatial-line"><span>{contract.title}</span><b aria-hidden="true">→</b><span>{clauses.length} clauses</span><b aria-hidden="true">→</b><span>{obligations.length} obligations</span></div><p className="op-body-sm" style={{ marginTop: "var(--op-space-4)" }}>Select a clause below to inspect its source text and relationship to the prepared obligations.</p></div><div className="op-demo-spatial-list">{clauses.map((clause) => <button key={clause.id} type="button" className={selectedClause?.id === clause.id ? "op-demo-clause-button op-demo-clause-button-active" : "op-demo-clause-button"} onClick={() => onSelectClause(clause.id)}><span className="op-kicker">{clause.number}</span><strong>{clause.title}</strong><span className="op-body-sm">{clause.category}</span></button>)}</div><ClauseInspector clause={selectedClause} /></div>;
}

function ClauseInspector({ clause }) {
  if (!clause) return <EmptyState title="Select a clause" description="Choose a prepared clause to inspect its context." />;
  return <div className="op-demo-clause-inspector"><SampleBadge live>Prepared clause intelligence</SampleBadge><h2 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>{clause.number} · {clause.title}</h2><div className="op-demo-inspector-grid"><div><span className="op-kicker">Category</span><p className="op-body-sm">{clause.category}</p></div><div><span className="op-kicker">Context</span><p className="op-body-sm">{clause.context}</p></div><div><span className="op-kicker">Evidence / reference</span><p className="op-body-sm">{clause.evidence}</p></div></div><blockquote className="op-demo-source-text">{clause.sourceText}</blockquote><p className="op-body-sm">Source text shown from the prepared demonstration contract. This is not a legal interpretation.</p></div>;
}