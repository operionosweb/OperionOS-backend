import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowUp, Mic, Square, RotateCcw, Volume2, FileText, Keyboard, PanelRight, Video, VideoOff } from "lucide-react";
import { useOrganization } from "../context/OrganizationContext";
import { useAuth } from "../context/AuthContext";
import OrganizationGate from "../components/demo/OrganizationGate";
import RequireOrganizationPermission from "../components/auth/RequireOrganizationPermission";
import { ORGANIZATION_PERMISSIONS, PLATFORM_PERMISSIONS } from "../lib/permissions";
import MattEnvironment from "../components/matt/MattEnvironment";
import MattProposal from "../components/matt/MattProposal";
import { PageHeader, DemoBadge, EvidenceCard } from "../demo/DemoUI";
import { contextualQuestion } from "../components/matt/mattState";
import { useMattSession } from "../components/matt/mattSessions";
import { createMattVoice } from "../components/matt/mattVoice";
import { askContractAssistant, listContracts, listContractDocuments, listDocumentVersions, searchContractIntelligence } from "../lib/contractsApi";
import "../styles/matt.css";
import "../styles/mattStudio.css";

export default function Matt({ demo = false, reportOnly = false }) {
  const organization = useOrganization();
  const { organizationId } = organization;
  const auth = useAuth();
  const [params] = useSearchParams();
  const [flight, setFlight] = useState(null);
  const [flightError, setFlightError] = useState("");
  const flightId = params.get("flight");
  useEffect(() => {
    let active = true;
    setFlight(null);
    setFlightError("");
    if (demo && flightId) import("../demo/globeIntelligenceData").then((module) => {
      if (!active) return;
      const match = module.createDemonstrationAircraft().find((item) => item.id === flightId);
      if (match) setFlight(match);
      else setFlightError("The requested demonstration flight is unavailable. No other flight or contract has been substituted.");
    }).catch((error) => { if (active) { console.error("Matt flight context loading failed", error); setFlightError("The selected demonstration flight could not load."); } });
    return () => { active = false; };
  }, [demo, flightId]);
  if (flightError) return <p role="alert">{flightError}</p>;
  if (demo && flightId && !flight) return <p role="status">Loading selected demonstration flight...</p>;
  if (!demo && auth.hasPlatformPermission(PLATFORM_PERMISSIONS.PLATFORM_ADMIN) && (!organizationId || (!organization.authorizationLoading && !organization.hasOrganizationPermission(ORGANIZATION_PERMISSIONS.CONTRACT_READ)))) {
    return <MattPresenceOnly/>;
  }
  return demo ? <MattExperience demo flight={flight} reportOnly={reportOnly}/> : <OrganizationGate><RequireOrganizationPermission permission={ORGANIZATION_PERMISSIONS.CONTRACT_READ}><MattExperience key={organizationId} organizationId={organizationId} reportOnly={reportOnly}/></RequireOrganizationPermission></OrganizationGate>;
}

export function MattPresenceOnly({ compact = false }) {
  const [mediaStatus, setMediaStatus] = useState("loading");
  const [mediaError, setMediaError] = useState("");
  return <main className={`matt-page${compact ? " matt-compact" : ""}`} data-matt-mode="platform-presence-only">
    {!compact && <header className="matt-heading"><div><span className="matt-eyebrow">OPERION / PLATFORM SESSION</span><h1>Matt</h1><p>Video presence without an organisation contract context.</p></div></header>}
    <div className="matt-layout">
      <MattEnvironment phase={mediaStatus} onMediaStatus={setMediaStatus} onMediaError={setMediaError}/>
      <section className="matt-workspace" aria-labelledby="matt-platform-presence-title">
        <span className="matt-eyebrow">PLATFORM-ONLY SESSION</span>
        <h2 id="matt-platform-presence-title">Matt video presence is available.</h2>
        <p>Contract review and customer data are unavailable without an authorized organization context and contract-read permission.</p>
        <p className="matt-studio-notice" role="status">This is continuous prerecorded video, not a live or answer-synchronised avatar conversation.</p>
        {mediaError && <p className="matt-error" role="alert">{mediaError}</p>}
      </section>
    </div>
  </main>;
}

export function MattExperience({ demo = false, organizationId, contract: selectedContract, analysisRunId: selectedAnalysis, flight = null, compact = false, reportOnly = false }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();
  const studio = true;
  const instanceId = useId();
  const dossierId = `matt-dossier-${instanceId}`, inputId = `matt-text-input-${instanceId}`;
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [contractId, setContractId] = useState(selectedContract?.id || params.get("contract") || "");
  const analysisScope = selectedAnalysis || params.get("analysis") || "";
  const scopeKey = `${demo ? "demo" : `${user?.id}:${organizationId}`}:${flight ? `flight:${flight.id}` : `contract:${contractId}`}`;
  const { state, dispatch, session } = useMattSession(scopeKey);
  const [contractSearch, setContractSearch] = useState("");
  const [question, setQuestionState] = useState(session.question);
  const setQuestion = (value) => setQuestionState((current) => {
    const next = typeof value === "function" ? value(current) : value;
    session.question = next;
    return next;
  });
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [readAnswers, setReadAnswers] = useState(false);
  const [support, setSupport] = useState({ input: false, output: false });
  const [mediaError, setMediaError] = useState("");
  const [mediaStatus, setMediaStatus] = useState("loading");
  const [scopeError, setScopeError] = useState("");
  const [showResponseText, setShowResponseText] = useState(session.showText);
  const [showTextInput, setShowTextInput] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(Boolean(session.state.result));
  const [feedback, setFeedback] = useState(session.feedback || {});
  const voiceRef = useRef(null), requestRef = useRef(null), composerRef = useRef(null), sequenceRef = useRef(0);
  const dockRef = useRef(null);
  const result = state.result;
  const busy = ["PROCESSING", "INVESTIGATING"].includes(state.phase);
  const onMediaError = useCallback((message) => setMediaError(message), []);
  const onMediaStatus = useCallback((status) => setMediaStatus(status), []);
  useEffect(() => { setQuestionState(session.question); setShowResponseText(session.showText); setFeedback(session.feedback || {}); setDossierOpen(Boolean(session.state.result)); }, [scopeKey, session]);
  useEffect(() => { session.showText = showResponseText; }, [session, showResponseText]);
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const root = dock.closest(".matt-studio");
    const observer = new ResizeObserver(() => root.style.setProperty("--matt-dock-height", `${dock.getBoundingClientRect().height}px`));
    observer.observe(dock);
    return () => { observer.disconnect(); root.style.removeProperty("--matt-dock-height"); };
  }, [reportOnly]);

  useEffect(() => {
    const voice = createMattVoice({ onEvent: dispatch, onTranscript: (transcript) => {
      setQuestion((current) => `${current}${current ? " " : ""}${transcript}`);
      if (studio) setShowTextInput(true);
    }, onVoices: setVoices });
    voiceRef.current = voice;
    setSupport(voice.supported);
    return () => {
      voice.dispose(); voiceRef.current = null;
      if (session.activeVoice === voice) session.activeVoice = null;
      if (requestRef.current) { requestRef.current.abort(); dispatch({ type: "INTERRUPT" }); requestRef.current = null; }
    };
  }, [scopeKey]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const next = selectedContract ? [selectedContract] : demo ? (await import("../demo/mattDemoAdapter")).MATT_DEMO_CATALOG : (await listContracts(organizationId, { signal: controller.signal })).contracts;
        if (!Array.isArray(next)) throw new Error("The contract catalog returned an invalid response.");
        if (!active) return;
        setCatalog(next);
        setContractId((current) => next.some((item) => item.id === current) ? current : demo ? next[0]?.id || "" : "");
        setCatalogState("ready");
      } catch (error) {
        if (active && !controller.signal.aborted) { setCatalogState("error"); setScopeError(error.message || "The authorized contract catalog could not be loaded."); }
      }
    }
    load();
    return () => { active = false; controller.abort(); };
  }, [demo, organizationId, selectedContract]);

  function interrupt() {
    requestRef.current?.abort();
    session.controller?.abort();
    requestRef.current = null;
    voiceRef.current?.stop();
    session.activeVoice?.stop();
    session.activeVoice = null;
    dispatch({ type: "INTERRUPT" });
  }
  function reset() { interrupt(); dispatch({ type: "RESET" }); session.feedback = {}; setFeedback({}); setQuestion(""); composerRef.current?.focus(); }
  function changeContract(value) { interrupt(); setContractId(value); setScopeError(""); }
  function startListening() {
    if (!voiceConsent) { dispatch({ type: "ERROR", error: "Please acknowledge the browser speech-service privacy notice before activating the microphone." }); return; }
    interrupt();
    session.activeVoice = voiceRef.current;
    voiceRef.current?.listen();
  }
  function read(text = result?.answer) {
    if (studio) { dispatch({ type: "ERROR", error: "Matt's video is prerecorded and is not synchronized to response audio. Speech output is disabled in this preview; inspect the evidence or enable response text." }); return; }
    if (!voiceConsent) { dispatch({ type: "ERROR", error: "Acknowledge the speech-service privacy notice before playback. Text remains available." }); return; }
    if (text) { interrupt(); voiceRef.current?.speak(text, { voiceURI, rate }); }
  }
  async function submit(event, suppliedQuestion = question) {
    event?.preventDefault();
    const raw = suppliedQuestion.trim();
    if (raw.length < 3 || raw.length > 500 || (!flight && !catalog.some((item) => item.id === contractId))) {
      dispatch({ type: "ERROR", error: "Select an available contract and enter a question between 3 and 500 characters." });
      return;
    }
    let resolved;
    try { resolved = contextualQuestion(raw, result); }
    catch (error) { dispatch({ type: "ERROR", error: error.message }); return; }
    interrupt();
    const controller = new AbortController(), requestId = `${Date.now()}-${++sequenceRef.current}`;
    session.controller = controller;
    requestRef.current = controller;
    dispatch({ type: "REQUEST", requestId, question: raw });
    setQuestion("");
    const operation = (activity) => dispatch({ type: "OPERATION", requestId, activity });
    try {
      let answer, analysisRunId = null;
      if (demo && flight) {
        operation("Retrieving only the selected illustrative flight's scenario and source limitations.");
        const adapter = await import("../components/matt/mattFlightIntelligence");
        if (controller.signal.aborted) return;
        answer = adapter.askMattFlight(resolved, flight);
      } else if (demo) {
        operation("Demonstration: retrieving prepared lease findings and source excerpts.");
        const adapter = await import("../components/matt/mattIntelligence");
        if (controller.signal.aborted) return;
        answer = adapter.askMattWorkspace(resolved, contractId, selectedContract);
      } else {
        if (analysisScope) {
          analysisRunId = analysisScope;
          operation("Retrieving the existing selected workspace analysis; no new extraction is started.");
          answer = (await askContractAssistant(analysisRunId, organizationId, resolved, { signal: controller.signal })).assistant;
        } else {
        operation("Retrieving the selected contract's authorized documents.");
        const documents = await listContractDocuments(contractId, organizationId, { signal: controller.signal });
        const document = documents.documents?.[0];
        if (!document) throw new Error("No analyzed document is available for this contract. Open the contract workspace to prepare intelligence.");
        operation("Resolving the existing document analysis version.");
        const versions = await listDocumentVersions(document.id, organizationId, { signal: controller.signal });
        analysisRunId = versions.versions?.[0]?.analysis_run_id;
        if (!analysisRunId) throw new Error("This document has no analysis run. Matt does not start extraction or paid analysis automatically.");
        operation("Searching the selected analysis run for relevant contract evidence.");
        await searchContractIntelligence(analysisRunId, organizationId, resolved, 10, { signal: controller.signal });
        operation("Search completed. Retrieving the existing evidence-grounded contract answer.");
        answer = (await askContractAssistant(analysisRunId, organizationId, resolved, { signal: controller.signal })).assistant;
        }
      }
      if (controller.signal.aborted) return;
      if (!answer || typeof answer.answer !== "string" || !Array.isArray(answer.findings) || !Array.isArray(answer.evidence) || typeof answer.established !== "boolean") throw new Error("The existing assistant returned an invalid response. No answer has been accepted.");
      const next = { ...answer, contractId: flight ? null : contractId, flightId: flight?.id, contractTitle: flight ? `${flight.flightNumber || flight.id} / ${flight.origin} to ${flight.destination}` : catalog.find((item) => item.id === contractId)?.title || "Selected contract", analysisRunId };
      dispatch({ type: "RESULT", requestId, result: next });
      setDossierOpen(true);
      if (!studio && readAnswers && voiceConsent) voiceRef.current?.speak(next.answer, { voiceURI, rate });
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: "ERROR", requestId, error: error.message || "Matt could not retrieve an evidence-backed answer." });
    } finally { if (requestRef.current === controller) requestRef.current = null; }
  }

  function compose(text) {
    setQuestion(text);
    if (studio) setShowTextInput(true);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  const scopeQuery = new URLSearchParams(flight ? { flight: flight.id } : { contract: contractId, ...(analysisScope ? { analysis: analysisScope } : {}) });
  const base = demo ? "/demo" : "/app";
  const returnPath = params.get("return");
  const returnTo = returnPath?.startsWith(`${base}/`) && !returnPath.startsWith(`${base}/matt/report`) ? returnPath : `${base}/matt?${scopeQuery}`;
  const fullReport = `${base}/matt/report?${scopeQuery}&return=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  if (reportOnly) return <main className="matt-page matt-full-report"><PageHeader eyebrow="MATT / COMPLETE RESPONSE REPORT" title={result?.contractTitle || "No retained report"} description="Evidence and limitations from the last completed question in this authorized session."/>
    <Link className="od-button" to={returnTo}>Return to Matt and conversation</Link>
    {result ? <article><h2>Response</h2><p>{result.answer}</p><h2>Findings</h2><ol>{result.findings.map((finding) => <li key={`${finding.type}-${finding.id}`}>{finding.type}: {finding.label}</li>)}</ol>
      <h2>Source evidence</h2>{result.evidence.map((source, i) => <EvidenceCard key={i} evidence={{ excerpt: source.excerpt, page: source.page_number, locator: source.source_locator }}/>)}
      <MattProposal result={result} demo={demo} onCompose={compose}/></article> : <p>This session has no completed response. Matt does not fabricate a report.</p>}</main>;
  return <main className={`matt-page matt-studio matt-cockpit${compact ? " matt-compact" : ""}`} data-mode={demo ? "demo" : "authenticated"} data-state={state.phase} data-experience="unified-matt" data-context={flight ? flight.id : contractId} data-text={showResponseText ? "visible" : "hidden"}>
    {studio ? <PageHeader eyebrow="MATT / YOUR OPERION COLLEAGUE" title="Let's look at what matters." description="Ask. Investigate. Understand the evidence." actions={<DemoBadge tone="neutral">{demo ? "DEMONSTRATION / PREPARED CONTRACT DATA" : "AUTHENTICATED / SELECTED CONTRACT SCOPE"}</DemoBadge>}/> : <header className="matt-heading"><div><span className="matt-eyebrow">MATT / YOUR OPERION COLLEAGUE</span><h1>Let's look at what matters.</h1><p>Ask. Investigate. Understand the evidence.</p></div>
      <span className="matt-provenance">{demo ? "DEMONSTRATION / PREPARED CONTRACT DATA" : "AUTHENTICATED / SELECTED CONTRACT SCOPE"}</span></header>}
    {studio && <div className="matt-studio-notice" role="status">{mediaStatus === "error" ? <VideoOff size={18} aria-hidden="true"/> : <Video size={18} aria-hidden="true"/>}<div>
      <strong>{mediaStatus === "playing" ? "Matt's video presence is active" : mediaStatus === "buffering" ? "Matt's video is buffering" : mediaStatus === "error" ? "Matt's video could not play" : "Loading Matt's video presence"}</strong>
      <p>Identity footage only. Live synchronized conversation is not connected. Review answers and evidence in Findings.</p>
    </div></div>}
    <div className={`matt-layout${studio && dossierOpen ? " has-proposal" : ""}`}>
      <MattEnvironment phase={state.phase} onMediaError={onMediaError} onMediaStatus={onMediaStatus} studio={studio}/>
      <section className={`matt-workspace${studio ? " od-card" : ""}`} aria-label="Matt conversation and findings">
        {studio && <div className="matt-studio-toolbar">
          <button type="button" aria-controls={dossierId} aria-expanded={dossierOpen} onClick={() => setDossierOpen((open) => !open)}><PanelRight size={18}/>{dossierOpen ? "Close findings" : "Inspect findings"}{result ? ` (${result.findings.length})` : ""}</button>
          <label><input type="checkbox" checked={showResponseText} onChange={(event) => { setShowResponseText(event.target.checked); if (event.target.checked) setDossierOpen(true); }}/>Show response text</label>
        </div>}
        {flight ? <div className="matt-context"><strong>{flight.flightNumber || flight.id} / {flight.origin} to {flight.destination}</strong><p>Illustrative flight only. Answers use this flight's scenario, not the demonstration lease or customer records.</p></div> : <div className="matt-context">
          <label>Contract context<select aria-label="Contract context" value={contractId} disabled={catalogState !== "ready"} onChange={(event) => changeContract(event.target.value)}>
            <option value="">Select an authorized contract</option>
            {catalog.filter((item) => item.id === contractId || (item.title || "").toLowerCase().includes(contractSearch.toLowerCase())).map((item) => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
          </select></label>
          <details className="matt-context-details"><summary>Scope and contract search</summary>
            <label>Search available contract names<input type="search" value={contractSearch} onChange={(event) => setContractSearch(event.target.value)} placeholder="Contract title"/></label>
            <p>{demo ? "Illustrative lease only. Other demo agreements share sample evidence and are excluded. No production records or external AI calls." : "Names come from your authorized organization catalog. Each question searches only the selected contract; no portfolio-wide ranking or automatic extraction."}</p>
          </details>
          {catalogState === "loading" && <p role="status">Loading available contract context...</p>}
          {scopeError && <p role="alert">{scopeError}</p>}
        </div>}
        <div className="matt-activity" role="status" aria-live="polite"><i aria-hidden="true"/><span>{state.activity}</span></div>
        {state.error && <p className="matt-error" role="alert">{state.error}</p>}
        {mediaError && <p className="matt-error" role="alert">{mediaError}</p>}
        <div id={dossierId} className="matt-report" aria-label="Intelligence report" hidden={studio && !dossierOpen}>
          {studio && <div className="matt-dossier-heading"><div><span className="matt-eyebrow">CONTEXTUAL INTELLIGENCE</span><h2>Findings and evidence</h2></div><button type="button" aria-label="Close findings panel" onClick={() => setDossierOpen(false)}>Close</button></div>}
          {result && (busy || state.error) && <p role="status">The retained report below is from the previous completed question, not the current request.</p>}
          {result?.analysisRunId && analysisScope && result.analysisRunId !== analysisScope && <p role="status">This retained report is from a different analysis version. Ask again to use the selected workspace version.</p>}
          {!result ? <div className="matt-welcome"><FileText size={28}/><h2>Evidence, not guesswork.</h2><p>Start with a contract question. Findings, source excerpts and follow-ups stay here beside Matt.</p>
            <div className="matt-prompts">{["What are the key obligations?", "Review the maintenance risks", "Which deadlines require trigger dates?"].map((prompt) => <button type="button" key={prompt} disabled={busy || !contractId} onClick={() => submit(null, prompt)}>{prompt}</button>)}</div></div>
            : <article><span className="matt-eyebrow">{demo ? "ILLUSTRATIVE FINDINGS / NOT VERIFIED CUSTOMER DATA" : "EXISTING STRUCTURED INTELLIGENCE / HUMAN REVIEW REQUIRED"}</span>
              <h2>{result.contractTitle}</h2>{(!studio || showResponseText) && <p className="matt-answer">{result.answer}</p>}
              <p>{result.established ? "Linked source evidence was supplied by the existing assistant; interpretation remains decision support, not legal advice." : "Not established. Do not infer that a clause, exposure or obligation exists."}</p>
              <ol className="matt-findings">{result.findings.map((finding) => <li key={`${finding.type}-${finding.id}`}>
                <button type="button" onClick={() => compose(`Explain ${finding.type}: ${finding.label}`.slice(0, 500))}><span>{finding.type}</span>{finding.label}</button>
              </li>)}</ol>
              {result.reasoning?.length > 0 && <details><summary>How the prepared findings were selected</summary><ul>{result.reasoning.map((item) => <li key={item}>{item}</li>)}</ul></details>}
              {result.limitations?.length > 0 && <div className="matt-review"><h3>Data limitations</h3><ul>{result.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              <details onToggle={(event) => { if (event.currentTarget.open) dispatch({ type: "REVIEWED" }); }}><summary>Supporting source evidence ({result.evidence.length})</summary>
                {result.evidence.map((source, index) => studio ? <EvidenceCard key={source.id || index} evidence={{ excerpt: source.excerpt, page: source.page_number, locator: source.source_locator }}/>: <blockquote key={source.id || index}><p>{source.excerpt}</p><cite>{source.source_locator || (source.page_number ? `Page ${source.page_number}` : "Source locator unavailable")}</cite>
                  {source.confidence !== null && source.confidence !== undefined && <small>Source confidence: {source.confidence}. Not a liability estimate.</small>}</blockquote>)}
              </details>
              {studio ? <details className="matt-proposal-disclosure"><summary>Review actions and proposal</summary><MattProposal result={result} demo={demo} onCompose={compose}/></details> : <section className="matt-review"><h3>Exposure and next action</h3><p>No new financial exposure is calculated by this presentation. Amounts, exclusions and missing evidence require review in the existing contract intelligence.</p><p>Review the supplied source and verify timing/attribution before taking action. Matt does not send notices or change records.</p></section>}
              <div className="matt-report-actions">{!studio && <button type="button" disabled={!support.output} onClick={() => read()}><Volume2 size={16}/>Read answer</button>}<button type="button" onClick={() => compose("Explain the second finding in more detail")}>Explain the second finding</button>
                <Link to={fullReport}>OPEN FULL REPORT</Link>{result.contractId && <Link to={`${base}/contracts/${encodeURIComponent(result.contractId)}${demo ? "/evidence" : "#evidence"}`}>Open existing contract workspace</Link>}</div>
              <div className="matt-report-actions" aria-label="Session-only response feedback">{["Helpful", "Needs review"].map((rating) => <button type="button" key={rating} aria-pressed={feedback[state.requestId] === rating} onClick={() => {
                const next = { ...session.feedback, [state.requestId]: rating }; session.feedback = next; setFeedback(next);
              }}>{rating}</button>)}<small>Feedback is retained in this session only, not submitted as approval.</small></div>
            </article>}
        </div>
        {(!studio || showResponseText) && <details className="matt-history"><summary>Conversation ({state.messages.length} messages, this visit only)</summary>{state.messages.map((message, index) => <p key={index}><strong>{message.role === "user" ? "You" : "Matt"}</strong> {message.text}</p>)}</details>}
        {studio && <div className="matt-studio-prompts" aria-label="Prepared intelligence questions">{(flight ? ["What happens if this flight is delayed by three hours?", "Which contractual clauses apply?", "What is the potential financial exposure?"] : result?.followUps?.length ? result.followUps : ["What are the key obligations?", "Review the maintenance risks", "Which deadlines require trigger dates?"]).map((prompt) => <button type="button" key={prompt} disabled={busy || (!contractId && !flight)} onClick={() => submit(null, prompt)}>{prompt}</button>)}</div>}
        <form ref={dockRef} className="matt-composer" onSubmit={submit}>
          {(!studio || showTextInput) && <div className="matt-text-input" id={inputId}><label>Ask Matt<textarea ref={composerRef} aria-label="Ask Matt" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={2} placeholder="Ask about the selected contract, or a previous finding..."/></label>
          <small>{question.length}/500 characters. Voice transcripts are reviewed before sending.</small></div>}
          <div className="matt-controls"><button type="button" className={state.phase === "LISTENING" ? "is-recording" : ""} onClick={state.phase === "LISTENING" ? interrupt : startListening} aria-pressed={state.phase === "LISTENING"}><Mic size={18}/>{state.phase === "LISTENING" ? "Stop microphone" : "Microphone"}</button>
            {(!studio || showTextInput) && <button type="submit" className="matt-send" disabled={question.trim().length < 3 || (!contractId && !flight) || catalogState !== "ready"}><ArrowUp size={18}/>Send</button>}
            <button type="button" onClick={interrupt}><Square size={16}/>Interrupt / stop</button>
            {studio && <button type="button" aria-controls={inputId} aria-expanded={showTextInput} onClick={() => setShowTextInput((open) => !open)}><Keyboard size={18}/>{showTextInput ? "Hide text input" : "Type a question"}</button>}
            {!studio && <><button type="button" onClick={() => { interrupt(); dispatch({ type: "READY" }); composerRef.current?.focus(); }}>Return to listening</button>
            <button type="button" onClick={reset}><RotateCcw size={16}/>Clear conversation</button></>}</div>
        </form>
        <details className="matt-voice-settings"><summary>Voice and privacy settings</summary>
          {studio && <button type="button" onClick={reset}><RotateCcw size={16}/>Clear conversation</button>}
          <p>Browser recognition may send microphone audio to its vendor's speech service. Voice synthesis may use a remote voice. Operion does not retain recordings or send contract documents for speech recognition. Enable only if your organization permits these services. Text works without them.</p>
          <label><input type="checkbox" checked={voiceConsent} onChange={(event) => { setVoiceConsent(event.target.checked); if (!event.target.checked) { interrupt(); setReadAnswers(false); } }}/>I permit browser speech services for this visit</label>
          {!studio && <><label><input type="checkbox" checked={readAnswers} disabled={!voiceConsent || !support.output} onChange={(event) => setReadAnswers(event.target.checked)}/>Read received answers aloud</label>
          <label>Voice<select value={voiceURI} disabled={!support.output} onChange={(event) => setVoiceURI(event.target.value)}><option value="">Browser default (identity may vary by device)</option>{voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} / {voice.lang}{voice.localService ? " / local" : " / possibly remote"}</option>)}</select></label>
          <label>Speech pace<select value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value={0.9}>Measured</option><option value={1}>Natural</option><option value={1.1}>Brisk</option></select></label></>}
          <p>{support.input ? "Browser speech recognition available; permission and network still required." : "Speech recognition unavailable in this browser: use text."} {studio ? "Matt's video is prerecorded; response speech is not available or synchronized in this preview." : support.output ? "Speech synthesis available; choose a device voice." : "Speech playback unavailable: answers remain in text."}</p>
        </details>
      </section>
    </div>
  </main>;
}
