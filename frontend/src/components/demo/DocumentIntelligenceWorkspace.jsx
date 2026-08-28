import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildDocumentSearchIndex, DEMO_DOCUMENT_CONTRACTS, DOCUMENT_SEARCH_MODES, DOCUMENT_SEARCH_TOPICS, relatedDocumentLinks, searchDocumentIndex } from "../../lib/demoDocumentSearch";

function highlight(text, query) {
  if (!query.trim()) return text;
  const terms = query.trim().split(/\s+/).filter(Boolean).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.join("|")})`, "ig");
  return text.split(pattern).map((part, index) => pattern.test(part) ? <mark key={`${part}-${index}`}>{part}</mark> : part);
}

function ResultDrawer({ result, onClose }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  if (!result) return null;
  const copySource = async () => {
    await navigator.clipboard?.writeText(result.clause.text);
    setCopied(true);
  };
  const focusClause = () => {
    try { sessionStorage.setItem(`operion.focusClause.${result.contractId}`, result.clauseId); } catch {}
  };
  return <div className="op-doc-drawer-backdrop" role="presentation" onClick={onClose}>
    <aside className="op-doc-drawer" role="dialog" aria-modal="true" aria-labelledby="doc-result-title" onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label="Close document result" onClick={onClose}>×</button>
      <span>FOUND IN SOURCE</span><h2 id="doc-result-title">Clause {result.clause.number} - {result.clause.title}</h2>
      <dl><div><dt>Contract</dt><dd>{result.contractTitle}</dd></div><div><dt>Counterparty</dt><dd>{result.counterparty}</dd></div><div><dt>Source page</dt><dd>{result.clause.page}</dd></div><div><dt>Confidence</dt><dd>{result.clause.confidence}</dd></div><div><dt>Evidence</dt><dd>Evidence-backed current contract text</dd></div></dl>
      <blockquote>{result.clause.text}</blockquote>
      <h3>Related Intelligence</h3>
      <div className="op-doc-related">{relatedDocumentLinks(result).map(([label, to]) => <Link key={label} to={to}>{label} ↗</Link>)}</div>
      <div className="op-doc-drawer-actions"><button type="button" onClick={copySource}>{copied ? "Source text copied" : "Copy source text"}</button><Link to={`/demo/contracts/${result.contractId}`} onClick={focusClause}>Open Contract Intelligence ↗</Link><Link to="/demo?view=review">Open in Contract Review ↗</Link><Link to="/demo?view=changes">Open Change Review ↗</Link></div>
    </aside>
  </div>;
}

export default function DocumentIntelligenceWorkspace() {
  const index = useMemo(() => buildDocumentSearchIndex(), []);
  const [query, setQuery] = useState(() => sessionStorage.getItem("operion.documentSearch.query") || "");
  const [mode, setMode] = useState(() => sessionStorage.getItem("operion.documentSearch.mode") || "All Intelligence");
  const [domain, setDomain] = useState(() => sessionStorage.getItem("operion.documentSearch.domain") || "All domains");
  const [confidence, setConfidence] = useState(() => sessionStorage.getItem("operion.documentSearch.confidence") || "All confidence");
  const [selected, setSelected] = useState(null);
  const [compare, setCompare] = useState(() => JSON.parse(sessionStorage.getItem("operion.documentSearch.compare") || "[]"));
  const [answer, setAnswer] = useState("");

  useEffect(() => { sessionStorage.setItem("operion.documentSearch.query", query); }, [query]);
  useEffect(() => { sessionStorage.setItem("operion.documentSearch.mode", mode); }, [mode]);
  useEffect(() => { sessionStorage.setItem("operion.documentSearch.domain", domain); }, [domain]);
  useEffect(() => { sessionStorage.setItem("operion.documentSearch.confidence", confidence); }, [confidence]);
  useEffect(() => { sessionStorage.setItem("operion.documentSearch.compare", JSON.stringify(compare)); }, [compare]);

  const activeQuery = query.trim();
  const results = useMemo(() => {
    return searchDocumentIndex(index, activeQuery, mode, domain, confidence);
  }, [activeQuery, confidence, domain, index, mode]);

  const coverage = DOCUMENT_SEARCH_TOPICS.map((topic) => ({ topic, results: searchDocumentIndex(index, topic) })).filter((item) => item.results.length);
  const ask = (prompt) => {
    const responses = {
      "Find every contract mentioning termination.": "Termination appears in Clause 14.1 Default and Termination in the current Aircraft Lease Agreement source text.",
      "Which contracts have notice periods?": "The Aircraft Lease Agreement has lifecycle records for notice periods: 90 days for renewal notice and 10 days for insurance certification renewal.",
      "Show me all insurance requirements.": "Insurance appears in Clause 10.2, with linked compliance, risk, performance, and action records.",
      "Where are service credits mentioned?": "Service credits appear in the structured commercial term linked to Clause 8.3 Maintenance and Utilisation.",
      "What historical information is searchable?": "Search currently covers available contract versions only. Historical versions, amendments, and redlines are not available in the demo.",
    };
    setAnswer(responses[prompt] || "No generated search result is returned unless it is backed by current demo contract evidence or structured intelligence.");
  };
  const toggleCompare = (id) => setCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 2 ? [...current, id] : current);
  const compared = compare.map((id) => index.find((item) => item.id === id)).filter(Boolean);

  return <section className="op-doc-workspace">
    <header className="op-doc-heading"><div><span>DOCUMENT INTELLIGENCE</span><h1>Document Intelligence</h1><p>Search, explore, and trace contract language directly to source evidence across the portfolio.</p></div><div><span>TRUST INDICATOR</span><strong>Evidence-first document search</strong><small>Contract text search over current demo evidence only.</small></div></header>
    <section className="op-doc-search"><span>SEARCH THE CONTRACT CORPUS</span><label htmlFor="doc-search">Search contracts, clauses, obligations, terms, or concepts...</label><div><input id="doc-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} placeholder="Search contracts, clauses, obligations, terms, or concepts..." /><button type="button" onClick={() => setQuery(query.trim())}>Search</button></div><nav>{DOCUMENT_SEARCH_TOPICS.slice(0, 7).map((topic) => <button type="button" key={topic} onClick={() => setQuery(topic)}>{topic}</button>)}</nav></section>
    <section className="op-doc-controls"><label>Search mode<select value={mode} onChange={(event) => setMode(event.target.value)}>{DOCUMENT_SEARCH_MODES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Intelligence domain<select value={domain} onChange={(event) => setDomain(event.target.value)}>{["All domains", "Obligations", "Risks", "Financial", "Compliance", "Performance", "Lifecycle", "Actions"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Confidence<select value={confidence} onChange={(event) => setConfidence(event.target.value)}>{["All confidence", "High confidence"].map((item) => <option key={item}>{item}</option>)}</select></label><p><strong>Search Coverage</strong> Contract text, clause text, source pages, and evidence text are available for the current demo corpus. Historical versions and amendments are not available.</p></section>
    <section className="op-doc-summary">{[["Results found", results.length], ["Contracts matched", new Set(results.map((item) => item.contractId)).size], ["Clauses matched", new Set(results.map((item) => item.clauseId)).size], ["Evidence-backed", results.filter((item) => item.clause.text).length], ["High confidence", results.filter((item) => Number.parseInt(item.clause.confidence, 10) >= 95).length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    <section className="op-doc-results"><h2>Results</h2>{results.length ? results.map((result) => <article key={result.id} tabIndex="0" onKeyDown={(event) => event.key === "Enter" && setSelected(result)}><div><span>{result.matchType}</span><h3>{result.contractTitle}</h3><p>{result.counterparty} · Clause {result.clause.number} · Page {result.clause.page} · {result.clause.confidence}</p></div><button type="button" onClick={() => setSelected(result)}><strong>{result.clause.title}</strong><p>{highlight(result.clause.text, activeQuery)}</p><em>Evidence-backed · View source ↗</em></button><div className="op-doc-result-links">{relatedDocumentLinks(result).map(([label, to]) => <Link key={label} to={to}>{label}</Link>)}<button type="button" onClick={() => toggleCompare(result.id)}>{compare.includes(result.id) ? "Remove comparison" : "Compare"}</button></div></article>) : <div className="op-doc-empty"><h3>No Evidence Found</h3><p>No matching contract language was found in the current demo corpus.</p>{coverage.slice(0, 4).map((item) => <button type="button" key={item.topic} onClick={() => setQuery(item.topic)}>Try {item.topic}</button>)}</div>}</section>
    <div className="op-doc-grid"><section><h2>Contract Language Coverage</h2>{coverage.map((item) => <button type="button" key={item.topic} onClick={() => setQuery(item.topic)}><strong>{item.topic}</strong><span>1 contract · {item.results.length} clause(s) · {item.results.filter((result) => result.clause.text).length} evidence-backed</span></button>)}</section><section><h2>Browse Contracts</h2>{DEMO_DOCUMENT_CONTRACTS.map((item) => <Link key={item.id} to={`/demo/contracts/${item.id}`}><strong>{item.title}</strong><span>{item.counterparty} · {item.type} · {item.clauses.length} clauses · evidence-backed</span></Link>)}</section><section><h2>Browse Evidence</h2>{index.map((item) => <button type="button" key={item.id} onClick={() => setSelected(item)}><strong>Clause {item.clause.number} - {item.clause.title}</strong><span>Page {item.clause.page} · {item.clause.confidence}</span></button>)}</section></div>
    <section className="op-doc-compare"><h2>Compare Contract Language</h2>{compared.length ? compared.map((item) => <div key={item.id}><span>{item.contractTitle}</span><strong>Clause {item.clause.number} - {item.clause.title}</strong><p>{item.clause.text}</p><em>Factual comparison only: contains this source language and confidence {item.clause.confidence}.</em></div>) : <p>Select up to two evidence-backed results to compare source language.</p>}</section>
    <section className="op-doc-ask"><h2>Ask Operion</h2>{["Find every contract mentioning termination.", "Which contracts have notice periods?", "Show me all insurance requirements.", "Where are service credits mentioned?", "What historical information is searchable?"].map((prompt) => <button type="button" key={prompt} onClick={() => ask(prompt)}>{prompt}</button>)}{answer && <div><span>GROUNDED RESPONSE · CURRENT DEMO CORPUS</span><p>{answer}</p></div>}</section>
    <ResultDrawer result={selected} onClose={() => setSelected(null)} />
  </section>;
}
