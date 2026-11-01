import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUp, Mic, Square, RotateCcw, Volume2, FileText } from "lucide-react";
import { useOrganization } from "../context/OrganizationContext";
import OrganizationGate from "../components/demo/OrganizationGate";
import RequireOrganizationPermission from "../components/auth/RequireOrganizationPermission";
import { ORGANIZATION_PERMISSIONS } from "../lib/permissions";
import MattEnvironment from "../components/matt/MattEnvironment";
import { INITIAL_MATT_STATE, mattReducer, contextualQuestion } from "../components/matt/mattState";
import { createMattVoice } from "../components/matt/mattVoice";
import { askContractAssistant, listContracts, listContractDocuments, listDocumentVersions, searchContractIntelligence } from "../lib/contractsApi";
import "../styles/matt.css";

export default function Matt({ demo = false }) {
  const { organizationId } = useOrganization();
  return demo ? <MattExperience key="demo" demo/> : <OrganizationGate><RequireOrganizationPermission permission={ORGANIZATION_PERMISSIONS.CONTRACT_READ}><MattExperience key={organizationId} organizationId={organizationId}/></RequireOrganizationPermission></OrganizationGate>;
}

function MattExperience({ demo = false, organizationId }) {
  const [params] = useSearchParams();
  const [state, dispatch] = useReducer(mattReducer, INITIAL_MATT_STATE);
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [contractId, setContractId] = useState(params.get("contract") || "");
  const [contractSearch, setContractSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [readAnswers, setReadAnswers] = useState(false);
  const [support, setSupport] = useState({ input: false, output: false });
  const [mediaError, setMediaError] = useState("");
  const [scopeError, setScopeError] = useState("");
  const voiceRef = useRef(null), requestRef = useRef(null), composerRef = useRef(null), sequenceRef = useRef(0);
  const result = state.result;
  const busy = ["PROCESSING", "INVESTIGATING"].includes(state.phase);
  const onMediaError = useCallback((message) => setMediaError(message), []);

  useEffect(() => {
    const voice = createMattVoice({ onEvent: dispatch, onTranscript: (transcript) => setQuestion((current) => `${current}${current ? " " : ""}${transcript}`), onVoices: setVoices });
    voiceRef.current = voice;
    setSupport(voice.supported);
    return () => { voice.dispose(); voiceRef.current = null; requestRef.current?.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const next = demo ? (await import("../demo/mattDemoAdapter")).MATT_DEMO_CATALOG : (await listContracts(organizationId, { signal: controller.signal })).contracts;
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
  }, [demo, organizationId]);

  function interrupt() {
    requestRef.current?.abort();
    requestRef.current = null;
    voiceRef.current?.stop();
    dispatch({ type: "INTERRUPT" });
  }
  function reset() { interrupt(); dispatch({ type: "RESET" }); setQuestion(""); composerRef.current?.focus(); }
  function changeContract(value) { reset(); setContractId(value); setScopeError(""); }
  function startListening() {
    if (!voiceConsent) { dispatch({ type: "ERROR", error: "Please acknowledge the browser speech-service privacy notice before activating the microphone." }); return; }
    interrupt();
    voiceRef.current?.listen();
  }
  function read(text = result?.answer) {
    if (!voiceConsent) { dispatch({ type: "ERROR", error: "Acknowledge the speech-service privacy notice before playback. Text remains available." }); return; }
    if (text) { interrupt(); voiceRef.current?.speak(text, { voiceURI, rate }); }
  }
  async function submit(event, suppliedQuestion = question) {
    event?.preventDefault();
    const raw = suppliedQuestion.trim();
    if (raw.length < 3 || raw.length > 500 || !catalog.some((item) => item.id === contractId)) {
      dispatch({ type: "ERROR", error: "Select an available contract and enter a question between 3 and 500 characters." });
      return;
    }
    let resolved;
    try { resolved = contextualQuestion(raw, result); }
    catch (error) { dispatch({ type: "ERROR", error: error.message }); return; }
    interrupt();
    const controller = new AbortController(), requestId = String(++sequenceRef.current);
    requestRef.current = controller;
    dispatch({ type: "REQUEST", requestId, question: raw });
    setQuestion("");
    const operation = (activity) => dispatch({ type: "OPERATION", requestId, activity });
    try {
      let answer, analysisRunId = null;
      if (demo) {
        operation("Demonstration: retrieving prepared lease findings and source excerpts.");
        const adapter = await import("../demo/mattDemoAdapter");
        if (controller.signal.aborted) return;
        answer = adapter.askMattDemo(contractId, resolved);
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
      if (controller.signal.aborted) return;
      if (!answer || typeof answer.answer !== "string" || !Array.isArray(answer.findings) || !Array.isArray(answer.evidence) || typeof answer.established !== "boolean") throw new Error("The existing assistant returned an invalid response. No answer has been accepted.");
      const next = { ...answer, contractId, contractTitle: catalog.find((item) => item.id === contractId)?.title || "Selected contract", analysisRunId };
      dispatch({ type: "RESULT", requestId, result: next });
      if (readAnswers && voiceConsent) voiceRef.current?.speak(next.answer, { voiceURI, rate });
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: "ERROR", requestId, error: error.message || "Matt could not retrieve an evidence-backed answer." });
    } finally { if (requestRef.current === controller) requestRef.current = null; }
  }

  return <main className="matt-page" data-mode={demo ? "demo" : "authenticated"} data-state={state.phase}>
    <header className="matt-heading"><div><span className="matt-eyebrow">MATT / YOUR OPERION COLLEAGUE</span><h1>Let's look at what matters.</h1><p>Ask. Investigate. Understand the evidence.</p></div>
      <span className="matt-provenance">{demo ? "DEMONSTRATION / PREPARED CONTRACT DATA" : "AUTHENTICATED / SELECTED CONTRACT SCOPE"}</span></header>
    <div className="matt-layout">
      <MattEnvironment phase={state.phase} onMediaError={onMediaError}/>
      <section className="matt-workspace" aria-label="Matt conversation and findings">
        <div className="matt-context">
          <label>Search available contract names<input type="search" value={contractSearch} onChange={(event) => setContractSearch(event.target.value)} placeholder="Contract title"/></label>
          <label>Contract context<select aria-label="Contract context" value={contractId} disabled={catalogState !== "ready"} onChange={(event) => changeContract(event.target.value)}>
            <option value="">Select an authorized contract</option>
            {catalog.filter((item) => item.id === contractId || (item.title || "").toLowerCase().includes(contractSearch.toLowerCase())).map((item) => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
          </select></label>
          <p>{demo ? "Illustrative lease only. Other demo agreements share sample evidence and are excluded. No production records or external AI calls." : "Names come from your authorized organization catalog. Each question searches only the selected contract; no portfolio-wide ranking or automatic extraction."}</p>
          {catalogState === "loading" && <p role="status">Loading available contract context...</p>}
          {scopeError && <p role="alert">{scopeError}</p>}
        </div>
        <div className="matt-activity" role="status" aria-live="polite"><i aria-hidden="true"/><span>{state.activity}</span></div>
        {state.error && <p className="matt-error" role="alert">{state.error}</p>}
        {mediaError && <p className="matt-error" role="alert">{mediaError}</p>}
        <div className="matt-report" aria-label="Intelligence report">
          {result && (busy || state.error) && <p role="status">The retained report below is from the previous completed question, not the current request.</p>}
          {!result ? <div className="matt-welcome"><FileText size={28}/><h2>Evidence, not guesswork.</h2><p>Start with a contract question. Findings, source excerpts and follow-ups stay here beside Matt.</p>
            <div className="matt-prompts">{["What are the key obligations?", "Review the maintenance risks", "Which deadlines require trigger dates?"].map((prompt) => <button type="button" key={prompt} disabled={busy || !contractId} onClick={() => submit(null, prompt)}>{prompt}</button>)}</div></div>
            : <article><span className="matt-eyebrow">{demo ? "ILLUSTRATIVE FINDINGS / NOT VERIFIED CUSTOMER DATA" : "EXISTING STRUCTURED INTELLIGENCE / HUMAN REVIEW REQUIRED"}</span>
              <h2>{result.contractTitle}</h2><p className="matt-answer">{result.answer}</p>
              <p>{result.established ? "Linked source evidence was supplied by the existing assistant; interpretation remains decision support, not legal advice." : "Not established. Do not infer that a clause, exposure or obligation exists."}</p>
              <ol className="matt-findings">{result.findings.map((finding) => <li key={`${finding.type}-${finding.id}`}>
                <button type="button" onClick={() => setQuestion(`Explain ${finding.type}: ${finding.label}`.slice(0, 500))}><span>{finding.type}</span>{finding.label}</button>
              </li>)}</ol>
              <details onToggle={(event) => { if (event.currentTarget.open) dispatch({ type: "REVIEWED" }); }}><summary>Supporting source evidence ({result.evidence.length})</summary>
                {result.evidence.map((source, index) => <blockquote key={source.id || index}><p>{source.excerpt}</p><cite>{source.source_locator || (source.page_number ? `Page ${source.page_number}` : "Source locator unavailable")}</cite>
                  {source.confidence !== null && source.confidence !== undefined && <small>Source confidence: {source.confidence}. Not a liability estimate.</small>}</blockquote>)}
              </details>
              <section className="matt-review"><h3>Exposure and next action</h3><p>No new financial exposure is calculated by this presentation. Amounts, exclusions and missing evidence require review in the existing contract intelligence.</p><p>Review the supplied source and verify timing/attribution before taking action. Matt does not send notices or change records.</p></section>
              <div className="matt-report-actions"><button type="button" disabled={!support.output} onClick={() => read()}><Volume2 size={16}/>Read answer</button><button type="button" onClick={() => setQuestion("Explain the second finding in more detail")}>Explain the second finding</button>
                <Link to={`${demo ? "/demo" : "/app"}/contracts/${encodeURIComponent(result.contractId)}${demo ? "/evidence" : "#evidence"}`}>Open existing contract workspace</Link></div>
            </article>}
        </div>
        <details className="matt-history"><summary>Conversation ({state.messages.length} messages, this visit only)</summary>{state.messages.map((message, index) => <p key={index}><strong>{message.role === "user" ? "You" : "Matt"}</strong> {message.text}</p>)}</details>
        <form className="matt-composer" onSubmit={submit}>
          <label>Ask Matt<textarea ref={composerRef} aria-label="Ask Matt" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={2} placeholder="Ask about the selected contract, or a previous finding..."/></label>
          <small>{question.length}/500 characters. Voice transcripts are reviewed before sending.</small>
          <div className="matt-controls"><button type="button" className={state.phase === "LISTENING" ? "is-recording" : ""} onClick={state.phase === "LISTENING" ? interrupt : startListening} aria-pressed={state.phase === "LISTENING"}><Mic size={18}/>{state.phase === "LISTENING" ? "Stop microphone" : "Microphone"}</button>
            <button type="submit" className="matt-send" disabled={question.trim().length < 3 || !contractId || catalogState !== "ready"}><ArrowUp size={18}/>Send</button>
            <button type="button" onClick={interrupt}><Square size={16}/>Interrupt / stop speaking</button>
            <button type="button" onClick={() => { interrupt(); dispatch({ type: "READY" }); composerRef.current?.focus(); }}>Return to listening</button>
            <button type="button" onClick={reset}><RotateCcw size={16}/>Clear conversation</button></div>
        </form>
        <details className="matt-voice-settings"><summary>Voice and privacy settings</summary>
          <p>Browser recognition may send microphone audio to its vendor's speech service. Voice synthesis may use a remote voice. Operion does not retain recordings or send contract documents for speech recognition. Enable only if your organization permits these services. Text works without them.</p>
          <label><input type="checkbox" checked={voiceConsent} onChange={(event) => { setVoiceConsent(event.target.checked); if (!event.target.checked) { interrupt(); setReadAnswers(false); } }}/>I permit browser speech services for this visit</label>
          <label><input type="checkbox" checked={readAnswers} disabled={!voiceConsent || !support.output} onChange={(event) => setReadAnswers(event.target.checked)}/>Read received answers aloud</label>
          <label>Voice<select value={voiceURI} disabled={!support.output} onChange={(event) => setVoiceURI(event.target.value)}><option value="">Browser default (identity may vary by device)</option>{voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} / {voice.lang}{voice.localService ? " / local" : " / possibly remote"}</option>)}</select></label>
          <label>Speech pace<select value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value={0.9}>Measured</option><option value={1}>Natural</option><option value={1.1}>Brisk</option></select></label>
          <p>{support.input ? "Browser speech recognition available; permission and network still required." : "Speech recognition unavailable in this browser: use text."} {support.output ? "Speech synthesis available; choose a device voice." : "Speech playback unavailable: answers remain in text."}</p>
        </details>
      </section>
    </div>
  </main>;
}
