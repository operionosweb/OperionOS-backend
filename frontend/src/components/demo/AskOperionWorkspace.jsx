import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DEMO_CONTRACT_INTELLIGENCE } from "../../lib/demoContractIntelligence";
import { buildDocumentSearchIndex, searchDocumentIndex } from "../../lib/demoDocumentSearch";

const contract = DEMO_CONTRACT_INTELLIGENCE["demo-aircraft-lease"];
const clauseById = Object.fromEntries(contract.clauses.map((clause) => [clause.id, clause]));
const starters = [
  ["Risk", "What are my biggest contract risks?"], ["Renewals", "Which contracts need attention before renewal?"], ["Money", "Where is the largest modeled exposure?"],
  ["Obligations", "What commitments are due soon?"], ["Evidence", "Where does the contract mention termination?"], ["Data Quality", "Where are the biggest intelligence gaps?"],
  ["Management", "What should I act on first?"], ["Negotiation", "Which contracts need negotiation preparation?"],
];

function readSession(key, fallback) { try { return JSON.parse(sessionStorage.getItem(key)) || fallback; } catch { return fallback; } }
function moneyTotal(records) { return records.reduce((sum, item) => sum + (item.exposureValue || 0), 0); }
function citeFromClause(clauseId) { const clause = clauseById[clauseId]; return clause ? { contract: contract.title, clause: `Clause ${clause.number} - ${clause.title}`, page: clause.page, evidence: clause.text, confidence: clause.confidence, clauseId } : null; }
function baseAnswer({ question, intent, answerType = "Summary answer", answer, records = [], citations = [], confidence = "High", limitations = [], actions = [], followUps = [], reasoning = [] }) {
  return { id: `assistant-${Date.now()}`, role: "assistant", content: answer, timestamp: new Date().toISOString(), intent, answerType, records, citations: citations.filter(Boolean), confidence, limitations, recommendedActions: actions, followUps, reasoning };
}
function detectDocumentQuery(q) { return /(where|find|mention|clause|contract say|source|evidence|termination language|liquidated damages|insurance|maintenance|service credits)/.test(q); }
function makeAnswer(question, index) {
  const q = question.toLowerCase();
  if (/compare|difference/.test(q)) {
    const results = searchDocumentIndex(index, q.includes("termination") ? "termination" : q.includes("renewal") ? "renewal" : "the", "Document Search").slice(0, 2);
    return baseAnswer({ question, intent: "Comparison", answerType: "Comparison", answer: results.length ? "The current demo can compare available source language only. It cannot determine better legal terms without an explicit deterministic rule." : "I don't have enough comparable source evidence to answer that.", records: results.map((item) => ({ label: item.clause.title, value: item.clause.text, to: "/demo?view=document-intelligence" })), citations: results.map((item) => citeFromClause(item.clauseId)), confidence: results.length ? "Medium" : "Low", limitations: ["Only the current demo contract corpus is available. Historical versions and redlines are not available."], actions: [["Open Document Intelligence", "/demo?view=document-intelligence"]], followUps: ["Show me termination evidence.", "What historical information is unavailable?"] });
  }
  if (/missing|weak evidence|incomplete|data quality|information.*missing/.test(q)) {
    return baseAnswer({ question, intent: "Data Quality", answerType: "Data availability answer", answer: "The largest data-quality gaps are missing return-inspection compliance evidence and unavailable historical versions, amendments, redlines, and historical financial terms.", records: [{ label: "Return inspection evidence", value: "Compliance evidence status: Missing", to: "/demo?view=data-quality" }, { label: "Historical data", value: "Versions, amendments, redlines and historical financial terms are unavailable", to: "/demo?view=changes" }], citations: [citeFromClause("return")], confidence: "High", limitations: ["Current contract intelligence is available; historical intelligence is not available in the current demo corpus."], actions: [["Open Data Quality", "/demo?view=data-quality"], ["Open Contract Changes", "/demo?view=changes"]], followUps: ["What should we fix first?", "Show evidence gaps."] });
  }
  if (/obligation|commitment|due|owner|overdue/.test(q)) {
    const items = contract.commitments.filter((item) => ["Due Soon", "At Risk", "Overdue", "Not Started"].includes(item.status));
    return baseAnswer({ question, intent: "Obligations", answerType: "Table", answer: `${items.length} commitments need attention in the current demo records.`, records: items.map((item) => ({ label: item.title, value: `${item.status} · ${item.owner} · due ${item.dueDate} · ${item.risk} risk`, to: "/demo/contracts/demo-aircraft-lease" })), citations: items.map((item) => citeFromClause(item.clauseId)), confidence: "High", reasoning: ["Commitments are filtered by Due Soon, At Risk, Overdue, or Not Started status."], actions: [["Open Obligations", "/demo/contracts/demo-aircraft-lease"]], followUps: ["Which obligation has the highest risk?", "Show source clauses."] });
  }
  if (/renew|notice|expiration|lifecycle|auto/.test(q)) {
    return baseAnswer({ question, intent: "Lifecycle", answerType: "Ranked list", answer: `${contract.lifecycle.length} lifecycle records require review, including an auto-renewal notice deadline.`, records: contract.lifecycle.map((item) => ({ label: item.event, value: `${item.renewalType} · ${item.renewalDate} · ${item.noticePeriodDays} day notice · ${item.priority}`, to: "/demo?view=lifecycle" })), citations: contract.lifecycle.map((item) => citeFromClause(item.clauseId)), confidence: "High", reasoning: ["Lifecycle records combine renewal date, notice period, priority, and linked risk/action records."], actions: [["Open Lifecycle", "/demo?view=lifecycle"], ["Open Negotiation", "/demo?view=negotiation"]], followUps: ["Which renewal has the highest exposure?", "Show renewal evidence."] });
  }
  if (!/vendor|counterparty|supplier/.test(q) && /financial|money|exposure|value|pricing|service credit|liquidated damages|commercial/.test(q)) {
    const total = moneyTotal(contract.riskRecords);
    return baseAnswer({ question, intent: "Financial", answerType: "Summary answer", answer: `Current demo data supports contractual value of ${contract.value} and modeled exposure of €${(total / 1000000).toFixed(2)}M. Realized spend and actual savings are not available.`, records: contract.riskRecords.map((item) => ({ label: item.title, value: `${item.exposure} · ${item.exposureType} · ${item.consequence}`, to: "/demo?view=exposure" })), citations: contract.riskRecords.map((item) => citeFromClause(item.clauseId)), confidence: "Medium", limitations: ["Modeled exposure is not realized spend, a financial guarantee, or legal certainty."], actions: [["Open Risk & Exposure", "/demo?view=exposure"], ["Open Economics", "/demo?view=economics"]], followUps: ["Which exposure is largest?", "Show commercial terms."] });
  }
  if (/compliance|gap|evidence missing|requirement/.test(q)) {
    return baseAnswer({ question, intent: "Compliance", answerType: "Table", answer: "The compliance record with the clearest evidence gap is return inspection evidence, which is marked Missing. Requirement status and evidence availability are separate signals.", records: contract.complianceRequirements.map((item) => ({ label: item.title, value: `${item.status} · evidence ${item.evidenceStatus} · ${item.priority}`, to: "/demo?view=compliance" })), citations: contract.complianceRequirements.map((item) => citeFromClause(item.clauseId)), confidence: "High", limitations: ["This is demo compliance intelligence, not a regulatory or legal verification."], actions: [["Open Compliance", "/demo?view=compliance"], ["Open Data Quality", "/demo?view=data-quality"]], followUps: ["Which compliance item is overdue?", "Show missing evidence."] });
  }
  if (/performance|sla|service|failing|observed/.test(q)) {
    return baseAnswer({ question, intent: "Performance", answerType: "Table", answer: "Demo observed performance shows one breached delivery milestone, one at-risk maintenance commitment, and one not-measured insurance certification delivery item.", records: contract.performanceCommitments.map((item) => ({ label: item.title, value: `${item.status} · target: ${item.target} · observed demo state: ${item.observed}`, to: "/demo?view=performance" })), citations: contract.performanceCommitments.map((item) => citeFromClause(item.clauseId)), confidence: "Medium", limitations: ["Performance values are prepared demo observations, not live operational telemetry."], actions: [["Open Performance", "/demo?view=performance"]], followUps: ["Which performance issue creates exposure?", "Show performance evidence."] });
  }
  if (/vendor|counterparty|supplier/.test(q)) {
    return baseAnswer({ question, intent: "Vendor", answerType: "Summary answer", answer: `${contract.counterparty} is the counterparty represented in the detailed demo contract. It carries ${contract.exposure} contract-level exposure and linked open risk records.`, records: [{ label: contract.counterparty, value: `${contract.title} · ${contract.type} · ${contract.exposure}`, to: "/demo?view=vendors" }], citations: contract.riskRecords.map((item) => citeFromClause(item.clauseId)), confidence: "Medium", limitations: ["Vendor concentration is limited to the prepared demo corpus."], actions: [["Open Vendor Intelligence", "/demo?view=vendors"], ["Open Counterparties", "/demo?view=counterparties"]], followUps: ["Which risks are tied to this vendor?", "Show vendor coverage."] });
  }
  if (/action|first|priority|management|recommend/.test(q)) {
    const items = contract.recommendations.filter((item) => item.status !== "Completed");
    return baseAnswer({ question, intent: "Actions", answerType: "Ranked list", answer: "Management should review the return inspection evidence first, followed by the overdue contractual notice and insurance certificate verification.", records: items.map((item) => ({ label: item.title, value: `${item.priority} · ${item.owner} · due ${item.due} · ${item.whyNow}`, to: "/demo?view=actions" })), citations: items.map((item) => citeFromClause(item.clauseId)), confidence: "High", reasoning: ["Priority combines criticality, due date, modeled exposure, and linked obligation/risk status."], actions: [["Open Actions", "/demo?view=actions"], ["Open Executive", "/demo?view=executive"]], followUps: ["Show the source clauses.", "Which action is overdue?"] });
  }
  if (/risk|highest|risky|worry/.test(q)) {
    const items = [...contract.riskRecords].sort((a, b) => b.exposureValue - a.exposureValue).slice(0, 4);
    return baseAnswer({ question, intent: "Risk", answerType: "Ranked list", answer: `The highest modeled risk is ${items[0].title}, with ${items[0].exposure} exposure and ${items[0].severity} severity.`, records: items.map((item) => ({ label: item.title, value: `${item.severity} · ${item.status} · ${item.exposure} · ${item.consequence}`, to: "/demo?view=exposure" })), citations: items.map((item) => citeFromClause(item.clauseId)), confidence: "High", reasoning: ["Risks are ranked by modeled exposure value and severity from current risk records."], actions: [["Open Risk & Exposure", "/demo?view=exposure"], ["Open Actions", "/demo?view=actions"]], followUps: ["Which risk has the strongest evidence?", "What should management act on first?"] });
  }
  if (detectDocumentQuery(q)) {
    const term = q.replace(/where does|contract|mention|mentions|find|show me|say|that|\?/g, " ").trim() || "termination";
    const results = searchDocumentIndex(index, term, "All Intelligence").slice(0, 3);
    return baseAnswer({ question, intent: "Document Search", answerType: "Evidence answer", answer: results.length ? `I found ${results.length} evidence-backed source result(s) for "${term}" in the current demo corpus.` : "I don't have enough evidence to answer that. No matching contract language was found in the current demo corpus.", records: results.map((item) => ({ label: `Clause ${item.clause.number} - ${item.clause.title}`, value: item.clause.text, to: "/demo?view=document-intelligence" })), citations: results.map((item) => citeFromClause(item.clauseId)), confidence: results.length ? "High" : "Low", limitations: ["Search covers current available contract text only. Historical versions are not available."], actions: [["Open Document Intelligence", "/demo?view=document-intelligence"], ["Open Contract Review", "/demo?view=review"]], followUps: ["Show me source clauses.", "What historical information is unavailable?"] });
  }
  return baseAnswer({ question, intent: "Unsupported", answerType: "Data availability answer", answer: "I don't have enough evidence to answer that from the current demo corpus.", confidence: "Low", limitations: ["Available data covers the prepared contract, current clauses, linked intelligence, and current evidence. It does not include internet sources, legal advice, historical versions, or live operational data."], actions: [["Search Documents", "/demo?view=document-intelligence"], ["Open Data Quality", "/demo?view=data-quality"], ["Open Contract Review", "/demo?view=review"]], followUps: ["What information is missing?", "Where does the contract mention termination?"] });
}

function SourceDrawer({ citation, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  if (!citation) return null;
  return <div className="op-ask-drawer-backdrop" role="presentation" onClick={onClose}><aside className="op-ask-drawer" role="dialog" aria-modal="true" aria-labelledby="ask-source-title" onClick={(event) => event.stopPropagation()}><button type="button" aria-label="Close source" onClick={onClose}>×</button><span>SOURCE EVIDENCE</span><h2 id="ask-source-title">{citation.clause}</h2><dl><div><dt>Source</dt><dd>{citation.contract}</dd></div><div><dt>Page</dt><dd>{citation.page}</dd></div><div><dt>Confidence</dt><dd>{citation.confidence}</dd></div></dl><blockquote>{citation.evidence}</blockquote><Link to="/demo?view=document-intelligence">Open Document Intelligence ↗</Link></aside></div>;
}

export default function AskOperionWorkspace() {
  const index = useMemo(() => buildDocumentSearchIndex(), []);
  const transcriptRef = useRef(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState(() => readSession("operion.ask.messages", []));
  const [recent, setRecent] = useState(() => readSession("operion.ask.recent", []));
  const [feedback, setFeedback] = useState(() => readSession("operion.ask.feedback", {}));
  const [context, setContext] = useState(() => sessionStorage.getItem("operion.ask.context") || "Current demo corpus");
  const [source, setSource] = useState(null);
  useEffect(() => { sessionStorage.setItem("operion.ask.messages", JSON.stringify(messages)); transcriptRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" }); }, [messages]);
  useEffect(() => { sessionStorage.setItem("operion.ask.recent", JSON.stringify(recent)); }, [recent]);
  useEffect(() => { sessionStorage.setItem("operion.ask.feedback", JSON.stringify(feedback)); }, [feedback]);
  const submit = (text = question) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const user = { id: `user-${Date.now()}`, role: "user", content: trimmed, timestamp: new Date().toISOString() };
    const assistant = makeAnswer(trimmed, index);
    setMessages((current) => [...current, user, assistant]);
    setRecent((current) => [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 8));
    setQuestion("");
  };
  const clearHistory = () => { setMessages([]); setRecent([]); setFeedback({}); };
  const setRating = (id, value) => setFeedback((current) => ({ ...current, [id]: value }));
  return <section className="op-ask-workspace">
    <header className="op-ask-heading"><div><span>ASK OPERION</span><h1>Ask Operion</h1><p>Ask questions across your contracts, obligations, risks, financial terms, compliance, performance, and evidence.</p></div><div><span>TRUST LABEL</span><strong>Evidence-first contract intelligence</strong><small>Current demo corpus · deterministic local answers</small></div></header>
    <section className="op-ask-compose"><div className="op-ask-context"><span>Context: {context}</span><button type="button" onClick={() => { setContext("Current demo corpus"); sessionStorage.removeItem("operion.ask.context"); }}>Remove context</button></div><label htmlFor="ask-operion-main">Ask Operion anything about your contracts...</label><textarea id="ask-operion-main" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Ask Operion anything about your contracts..." /><button type="button" onClick={() => submit()}>Send</button></section>
    {!messages.length && <section className="op-ask-starters"><h2>Conversation Starters</h2>{starters.map(([label, prompt]) => <button type="button" key={label} onClick={() => submit(prompt)}><span>{label}</span><strong>{prompt}</strong></button>)}</section>}
    <div className="op-ask-layout"><section className="op-ask-thread" ref={transcriptRef} aria-label="Ask Operion conversation">{messages.map((message) => message.role === "user" ? <article key={message.id} className="op-ask-message op-ask-user"><span>User</span><p>{message.content}</p></article> : <article key={message.id} className="op-ask-message op-ask-assistant"><span>Assistant · {message.answerType}</span><h2>Answer</h2><p>{message.content}</p>{!!message.records?.length && <div><h3>Supporting Records</h3>{message.records.map((item) => <Link key={`${message.id}-${item.label}`} to={item.to}><strong>{item.label}</strong><small>{item.value}</small></Link>)}</div>}{!!message.citations?.length && <div><h3>Supporting Evidence</h3>{message.citations.map((citation) => <button type="button" key={`${message.id}-${citation.clause}`} onClick={() => setSource(citation)}><strong>{citation.clause}</strong><small>{citation.contract} · page {citation.page} · {citation.confidence}</small></button>)}</div>}{!!message.reasoning?.length && <details><summary>Show reasoning</summary>{message.reasoning.map((item) => <p key={item}>{item}</p>)}</details>}<div className="op-ask-quality"><strong>Confidence: {message.confidence}</strong><span>Confidence reflects available evidence strength, not legal certainty.</span></div>{!!message.limitations?.length && <div className="op-ask-limitations"><h3>Limitations</h3>{message.limitations.map((item) => <p key={item}>{item}</p>)}</div>}<div className="op-ask-actions"><h3>Recommended Next Step</h3>{message.recommendedActions.map(([label, to]) => <Link key={label} to={to}>{label} ↗</Link>)}</div>{!!message.followUps?.length && <div className="op-ask-followups"><h3>Suggested Follow-ups</h3>{message.followUps.map((item) => <button type="button" key={item} onClick={() => submit(item)}>{item}</button>)}</div>}<div className="op-ask-feedback"><span>Answer quality: {message.citations?.length ? "Evidence-backed" : "Limited by available data"}</span><button type="button" aria-label="Mark answer helpful" onClick={() => setRating(message.id, "helpful")}>{feedback[message.id] === "helpful" ? "Helpful saved" : "Helpful"}</button><button type="button" aria-label="Mark answer not helpful" onClick={() => setRating(message.id, "not-helpful")}>{feedback[message.id] === "not-helpful" ? "Not helpful saved" : "Not helpful"}</button></div></article>)}</section>
      <aside className="op-ask-side"><h2>Recent Questions</h2>{recent.map((item) => <button type="button" key={item} onClick={() => submit(item)}>{item}</button>)}<button type="button" onClick={clearHistory}>Clear history</button><h2>Answer Sources</h2><p>Current contract records, derived intelligence, source evidence, and calculated relationships. No live LLM, external search, or legal advice is used in this demo.</p></aside></div>
    <SourceDrawer citation={source} onClose={() => setSource(null)} />
  </section>;
}
