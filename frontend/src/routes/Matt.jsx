import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowUp, Mic, Square, RotateCcw, FileText, Keyboard, PanelRight, Video, VideoOff } from "lucide-react";
import { useOrganization } from "../context/OrganizationContext";
import { useAuth } from "../context/AuthContext";
import OrganizationGate from "../components/demo/OrganizationGate";
import RequireOrganizationPermission from "../components/auth/RequireOrganizationPermission";
import { ORGANIZATION_PERMISSIONS, PLATFORM_PERMISSIONS } from "../lib/permissions";
import MattEnvironment from "../components/matt/MattEnvironment";
import MattProposal from "../components/matt/MattProposal";
import { PageHeader, DemoBadge, EvidenceCard, InfoCard } from "../demo/DemoUI";
import { contextualQuestion } from "../components/matt/mattState";
import { useMattSession } from "../components/matt/mattSessions";
import { createMattVoice } from "../components/matt/mattVoice";
import { createMattMicrophone, supportsMattCapturedSpeech } from "../components/matt/mattMicrophone";
import { createMattRealtimeSpeech, supportsMattRealtimeSpeech } from "../components/matt/mattRealtimeSpeech";
import { useMattLive } from "../components/matt/useMattLive";
import { askContractAssistant, listContracts, listContractDocuments, listDocumentVersions, searchContractIntelligence } from "../lib/contractsApi";
import { mattPageId, MATT_CONTEXT_MODES, MATT_PAGE_IDS } from "../../../shared/operionPlatformKnowledge.js";
import { preparedPlatformGuide } from "../../../shared/mattPreparedGuide.js";
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
  if (demo && flightId && flight?.id !== flightId) return <p role="status">Loading selected demonstration flight...</p>;
  if (!demo && auth.hasPlatformPermission(PLATFORM_PERMISSIONS.PLATFORM_ADMIN) && (!organizationId || (!organization.authorizationLoading && !organization.hasOrganizationPermission(ORGANIZATION_PERMISSIONS.CONTRACT_READ)))) {
    return <MattPresenceOnly/>;
  }
  return demo ? <MattExperience demo flight={flight} reportOnly={reportOnly}/> : <OrganizationGate><RequireOrganizationPermission permission={ORGANIZATION_PERMISSIONS.CONTRACT_READ}><MattExperience key={organizationId} organizationId={organizationId} reportOnly={reportOnly}/></RequireOrganizationPermission></OrganizationGate>;
}

export function MattPresenceOnly({ compact = false }) {
  const { user } = useAuth();
  const [mediaStatus, setMediaStatus] = useState("loading");
  const [mediaError, setMediaError] = useState("");
  const [question, setQuestion] = useState("");
  const [guide, setGuide] = useState(null);
  return <main className={`matt-page${compact ? " matt-compact" : ""}`} data-matt-mode="platform-presence-only">
    {!compact && <header className="matt-heading"><div><span className="matt-eyebrow">OPERION / PLATFORM SESSION</span><h1>Matt</h1><p>Video presence without an organisation contract context.</p></div></header>}
    <div className="matt-layout">
      <MattEnvironment introductionKey={`user:${user?.id}`} phase={mediaStatus} onMediaStatus={setMediaStatus} onMediaError={setMediaError}/>
      <section className="matt-workspace" aria-labelledby="matt-platform-presence-title">
        <span className="matt-eyebrow">PLATFORM-ONLY SESSION</span>
        <h2 id="matt-platform-presence-title">Matt requires an authorized contract context.</h2>
        <p>Contract review and customer data are unavailable without an authorized organization context and contract-read permission.</p>
        <p className="matt-studio-notice" role="status">The introduction plays once. Live contract conversation is unavailable without an authorized organization context.</p>
        <form onSubmit={(event) => { event.preventDefault(); setGuide(preparedPlatformGuide(question)); }}>
          <label>Prepared Operion guide<input aria-label="Prepared Operion guide" value={question} onChange={(event) => setQuestion(event.target.value)} minLength={3} maxLength={500} required/></label>
          <button type="submit">Open platform guidance</button>
        </form>
        {guide && <section aria-label="Prepared platform answer"><p>{guide.answer}</p><p>{guide.limitations[0]}</p></section>}
        {mediaError && <p className="matt-error" role="alert">{mediaError}</p>}
      </section>
    </div>
  </main>;
}

export function MattExperience({ demo = false, organizationId, contract: selectedContract, analysisRunId: selectedAnalysis, flight = null, compact = false, reportOnly = false, initialMode, onScopeChange }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();
  const { organizationRole } = useOrganization();
  const studio = true;
  const instanceId = useId();
  const dossierId = `matt-dossier-${instanceId}`, inputId = `matt-text-input-${instanceId}`;
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [contractId, setContractId] = useState(selectedContract?.id || params.get("contract") || "");
  const analysisScope = selectedAnalysis || params.get("analysis") || "";
  const requestedMode = initialMode || params.get("scope") || "analysis";
  const [contextMode, setContextMode] = useState(MATT_CONTEXT_MODES.includes(requestedMode) ? requestedMode : "analysis");
  const pageId = MATT_PAGE_IDS.includes(params.get("page")) ? params.get("page") : mattPageId(location.pathname);
  const scopeKey = `${demo ? "demo" : `${user?.id}:${organizationId}:${organizationRole}`}:${contextMode}:${contextMode === "analysis" ? flight ? `flight:${flight.id}` : `contract:${contractId}` : "all"}`;
  const { state, dispatch, session } = useMattSession(scopeKey);
  const live = useMattLive({ demo, organizationId, scopeKey });
  const realtimeSpeech = live.speechProvider === "openai-realtime";
  const [contractSearch, setContractSearch] = useState("");
  const [question, setQuestionState] = useState(session.question);
  const setQuestion = (value) => setQuestionState((current) => {
    const next = typeof value === "function" ? value(current) : value;
    session.question = next;
    return next;
  });
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [microphoneState, setMicrophoneState] = useState("NOT_REQUESTED");
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [speechInputState, setSpeechInputState] = useState("STOPPED");
  const [support, setSupport] = useState({ input: false, output: false });
  const [mediaError, setMediaError] = useState("");
  const [mediaStatus, setMediaStatus] = useState("loading");
  const [scopeError, setScopeError] = useState("");
  const [showResponseText, setShowResponseText] = useState(session.showText);
  const [showTextInput, setShowTextInput] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(Boolean(session.state.result));
  const [feedback, setFeedback] = useState(session.feedback || {});
  const voiceRef = useRef(null), microphoneRef = useRef(null), requestRef = useRef(null), composerRef = useRef(null), sequenceRef = useRef(0), submitRef = useRef(null);
  const liveRef = useRef(live);
  const previousLiveConsent = useRef(live.consent);
  liveRef.current = live;
  const result = state.result;
  const busy = ["PROCESSING", "INVESTIGATING"].includes(state.phase);
  const onMediaError = useCallback((message) => {
    setMediaError(message);
    if (message && liveRef.current.connected) {
      liveRef.current.setState("ERROR");
      void liveRef.current.dispose();
    }
  }, []);
  const onMediaStatus = useCallback((status) => setMediaStatus(status), []);
  useEffect(() => { setQuestionState(session.question); setShowResponseText(session.showText); setFeedback(session.feedback || {}); setDossierOpen(Boolean(session.state.result)); }, [scopeKey, session]);
  useEffect(() => { session.showText = showResponseText; }, [session, showResponseText]);

  useEffect(() => {
    setVoiceConsent(false);
    const onVoiceEvent = (event) => {
      if (!realtimeSpeech || !["INPUT_STOPPED", "RECONNECTING"].includes(event.type)) dispatch(event);
      if (realtimeSpeech) {
        if (event.type === "LISTEN") setSpeechInputState("TRANSMITTING");
        if (event.type === "OPERATION") setSpeechInputState("CONNECTING");
        if (event.type === "RECONNECTING") setSpeechInputState("RECONNECTING");
        if (event.type === "ERROR") setSpeechInputState("ERROR");
        if (event.type === "INPUT_STOPPED") setSpeechInputState("STOPPED");
      }
      if (event.type === "LISTEN" && (!realtimeSpeech || !["SPEAKING", "PROCESSING"].includes(liveRef.current.state))) liveRef.current.setState("LISTENING");
      if (event.type === "ERROR" || (!realtimeSpeech && event.type === "TRANSCRIBED")) {
        microphoneRef.current?.pause();
        if (event.type === "ERROR") liveRef.current.setState("ERROR");
      }
    };
    const onTranscript = (transcript) => {
      if (liveRef.current.connected) void submitRef.current(null, transcript, false, realtimeSpeech);
      else { setQuestion((current) => `${current}${current ? " " : ""}${transcript}`); setShowTextInput(true); }
    };
    const voice = realtimeSpeech ? createMattRealtimeSpeech({
      negotiate: (sdp) => liveRef.current.openSpeech(sdp),
      terminate: (connection) => liveRef.current.endSpeech(connection),
      onEvent: onVoiceEvent, onTranscript,
      onSpeechStart: () => interrupt(true),
    }) : createMattVoice({ onEvent: onVoiceEvent, onTranscript, onVoices: () => {} });
    voiceRef.current = voice;
    const microphone = createMattMicrophone({
      supportsInput: realtimeSpeech ? supportsMattRealtimeSpeech : supportsMattCapturedSpeech,
      onState: setMicrophoneState,
      onError: (error) => { setMicrophoneEnabled(false); dispatch({ type: "ERROR", error }); },
      onRevoked: () => { voice.stop(); liveRef.current.setState("ERROR"); },
    });
    microphoneRef.current = microphone;
    setMicrophoneState("NOT_REQUESTED"); setMicrophoneEnabled(false);
    setSupport({ ...voice.supported, input: realtimeSpeech ? supportsMattRealtimeSpeech() : supportsMattCapturedSpeech() });
    return () => {
      sequenceRef.current++;
      voice.dispose(); voiceRef.current = null;
      microphone.dispose(); microphoneRef.current = null;
      if (session.activeVoice === voice) session.activeVoice = null;
      if (requestRef.current) { requestRef.current.abort(); dispatch({ type: "INTERRUPT" }); requestRef.current = null; }
    };
  }, [scopeKey, realtimeSpeech]);
  useEffect(() => {
    if (live.state === "ERROR" || (previousLiveConsent.current && !live.consent)) {
      microphoneRef.current?.disable();
      voiceRef.current?.stop();
      setMicrophoneEnabled(false);
    }
    previousLiveConsent.current = live.consent;
  }, [live.state, live.consent]);
  useEffect(() => {
    const release = () => {
      microphoneRef.current?.disable(); voiceRef.current?.stop();
      setMicrophoneEnabled(false); dispatch({ type: "INTERRUPT" });
    };
    window.addEventListener("pagehide", release);
    return () => window.removeEventListener("pagehide", release);
  }, [dispatch]);

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

  async function interrupt(keepListening = false) {
    keepListening = keepListening === true && realtimeSpeech;
    sequenceRef.current++;
    requestRef.current?.abort();
    session.controller?.abort();
    requestRef.current = null;
    if (!keepListening) {
      voiceRef.current?.stop();
      microphoneRef.current?.pause();
      session.activeVoice?.stop();
      session.activeVoice = null;
    }
    dispatch({ type: "INTERRUPT" });
    const acknowledged = await live.interrupt();
    if (keepListening && acknowledged === false) throw new Error("Live interruption failed. Reconnect Matt before another spoken question.");
  }
  function reset() { interrupt(); dispatch({ type: "RESET" }); session.feedback = {}; setFeedback({}); setQuestion(""); composerRef.current?.focus(); }
  function changeContract(value) { interrupt(); setContractId(value); setScopeError(""); }
  async function startListening() {
    if (!voiceConsent) { dispatch({ type: "ERROR", error: "Please acknowledge the selected speech-processing privacy notice before activating the microphone." }); return; }
    if (realtimeSpeech && !live.connected) { dispatch({ type: "ERROR", error: "Connect approved live Matt before transmitting microphone audio." }); return; }
    const voice = voiceRef.current;
    void live.enableAudio();
    const interrupted = interrupt();
    const captured = microphoneRef.current?.acquire();
    const generation = sequenceRef.current;
    const [track] = await Promise.all([captured, interrupted]);
    if (!track || voiceRef.current !== voice || sequenceRef.current !== generation) return;
    if (realtimeSpeech) {
      try { await live.endSpeech(); }
      catch {
        microphoneRef.current?.disable();
        dispatch({ type: "ERROR", error: "Speech cleanup could not be confirmed. Disconnect Matt before retrying." });
        return;
      }
      if (voiceRef.current !== voice || sequenceRef.current !== generation) { microphoneRef.current?.pause(); return; }
    }
    setMicrophoneEnabled(true);
    session.activeVoice = voiceRef.current;
    voiceRef.current?.listen(track);
  }
  function disableMicrophone() {
    microphoneRef.current?.disable();
    setMicrophoneEnabled(false);
    void interrupt();
  }
  async function submit(event, suppliedQuestion = question, confirmation = false, keepListening = false) {
    event?.preventDefault();
    const raw = suppliedQuestion.trim();
    if (raw.length < 3 || raw.length > 500 || (contextMode === "analysis" && !flight && !catalog.some((item) => item.id === contractId))) {
      dispatch({ type: "ERROR", error: "Select an available contract and enter a question between 3 and 500 characters." });
      return;
    }
    let resolved;
    try { resolved = live.connected ? raw : contextualQuestion(raw, result); }
    catch (error) { dispatch({ type: "ERROR", error: error.message }); return; }
    const interrupted = interrupt(keepListening), generation = sequenceRef.current;
    await interrupted;
    if (sequenceRef.current !== generation) return;
    const controller = new AbortController(), requestId = `${Date.now()}-${++sequenceRef.current}`;
    session.controller = controller;
    requestRef.current = controller;
    dispatch({ type: "REQUEST", requestId, question: raw });
    setQuestion("");
    const operation = (activity) => dispatch({ type: "OPERATION", requestId, activity });
    try {
      let answer, analysisRunId = null;
      if (contextMode !== "analysis") {
        if (live.connected) {
          operation("Retrieving the current authorized account scope and reviewed Operion knowledge.");
          answer = await live.ask(undefined, resolved, controller.signal, confirmation, { contextMode, pageId });
        } else if (contextMode === "platform") {
          operation("Opening the reviewed platform guide. Live AI is not connected.");
          answer = preparedPlatformGuide(raw);
        } else {
          throw new Error("Connect approved live Matt to reason across the authorized account. Select a contract for existing structured findings, or Operion guide for prepared navigation help.");
        }
      } else if (demo && live.connected) {
        operation("Generating an evidence-backed answer from the server-authorized prepared Demo context.");
        analysisRunId = flight?.id || contractId;
        answer = await live.ask(analysisRunId, resolved, controller.signal, confirmation, { contextMode, pageId });
      } else if (demo && flight) {
        operation("Retrieving only the selected illustrative flight's scenario and source limitations.");
        const adapter = await import("../components/matt/mattFlightIntelligence");
        if (controller.signal.aborted) return;
        answer = adapter.askMattFlight(resolved, flight);
      } else if (demo) {
        operation("Demonstration: retrieving prepared lease findings and source excerpts.");
        const adapter = await import("../components/matt/mattIntelligence");
        if (controller.signal.aborted) return;
        answer = adapter.askMattWorkspace(resolved, contractId, selectedContract || catalog.find((item) => item.id === contractId));
      } else {
        if (analysisScope) {
          analysisRunId = analysisScope;
          operation("Retrieving the existing selected workspace analysis; no new extraction is started.");
          answer = live.connected ? await live.ask(analysisRunId, resolved, controller.signal, confirmation, { contextMode, pageId })
            : (await askContractAssistant(analysisRunId, organizationId, resolved, { signal: controller.signal })).assistant;
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
        answer = live.connected ? await live.ask(analysisRunId, resolved, controller.signal, confirmation, { contextMode, pageId })
          : (await askContractAssistant(analysisRunId, organizationId, resolved, { signal: controller.signal })).assistant;
        }
      }
      if (controller.signal.aborted) return;
      if (!answer || typeof answer.answer !== "string" || !Array.isArray(answer.findings) || !Array.isArray(answer.evidence) || typeof answer.established !== "boolean") throw new Error("The existing assistant returned an invalid response. No answer has been accepted.");
      const next = { ...answer, contractId: contextMode !== "analysis" || flight ? null : contractId, flightId: contextMode === "analysis" ? flight?.id : null, contractTitle: contextMode !== "analysis" ? contextMode === "platform" ? "Operion platform guide" : "Authorized account review" : flight ? `${flight.flightNumber || flight.id} / ${flight.origin} to ${flight.destination}` : catalog.find((item) => item.id === contractId)?.title || "Selected contract", analysisRunId };
      dispatch({ type: "RESULT", requestId, result: next });
      setDossierOpen(true);
    } catch (error) {
      if (!controller.signal.aborted) { live.setState("ERROR"); dispatch({ type: "ERROR", requestId, error: error.message || "Matt could not retrieve an evidence-backed answer." }); }
    } finally { if (requestRef.current === controller) requestRef.current = null; }
  }
  submitRef.current = submit;

  function compose(text) {
    setQuestion(text);
    if (studio) setShowTextInput(true);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  const scopeQuery = new URLSearchParams({ ...(flight ? { flight: flight.id } : { contract: contractId, ...(analysisScope ? { analysis: analysisScope } : {}) }), ...(contextMode !== "analysis" ? { scope: contextMode } : {}), page: pageId });
  const base = demo ? "/demo" : "/app";
  const returnPath = params.get("return");
  const returnTo = returnPath?.startsWith(`${base}/`) && !returnPath.startsWith(`${base}/matt/report`) ? returnPath : `${base}/matt?${scopeQuery}`;
  const returnQuery = new URLSearchParams(location.search);
  returnQuery.set("scope", contextMode);
  returnQuery.set("page", pageId);
  const fullReport = `${base}/matt/report?${scopeQuery}&return=${encodeURIComponent(`${location.pathname}?${returnQuery}`)}`;
  const canAsk = contextMode !== "analysis" || Boolean(flight || (contractId && catalogState === "ready"));
  const suggestions = contextMode === "platform" ? ["What can you help me with?", "How does the Globe work?", "Which features are operational?"]
    : contextMode === "account" ? ["Which contracts have existing OCI findings?", "Which obligations need review?", "What evidence is missing across the account?"]
    : flight ? ["What happens if this flight is delayed by three hours?", "Which contractual clauses apply?", "What is the potential financial exposure?"]
    : result?.followUps?.length ? result.followUps
    : ["What are the key obligations?", "Review the maintenance risks", "Which deadlines require trigger dates?"];
  if (reportOnly) return <main className="matt-page matt-full-report"><PageHeader eyebrow="MATT / COMPLETE RESPONSE REPORT" title={result?.contractTitle || "No retained report"} description="Evidence and limitations from the last completed question in this authorized session."/>
    <Link className="od-button" to={returnTo}>Return to Matt and conversation</Link>
    {result ? <article><h2>Response</h2><p>{result.answer}</p><h2>Findings</h2><ol>{result.findings.map((finding) => <li key={`${finding.type}-${finding.id}`}>{finding.type}: {finding.label}</li>)}</ol>
      <h2>Source evidence</h2>{result.evidence.map((source, i) => <EvidenceCard key={i} evidence={{ excerpt: source.excerpt, page: source.page_number, locator: source.source_locator }}/>)}
      <MattProposal result={result} demo={demo} onCompose={compose}/></article> : <p>This session has no completed response. Matt does not fabricate a report.</p>}</main>;
  return <main className={`matt-page matt-studio matt-cockpit${compact ? " matt-compact" : ""}`} data-mode={demo ? "demo" : "authenticated"} data-state={state.phase} data-experience="unified-matt" data-context={flight ? flight.id : contractId} data-question-scope={contextMode} data-text={showResponseText ? "visible" : "hidden"}>
    {studio ? <PageHeader eyebrow="MATT / YOUR OPERION COLLEAGUE" title="Ask Matt" description="Ask. Investigate. Understand the evidence." actions={<DemoBadge tone="neutral">{demo ? "PREPARED DEMO DATA" : "AUTHORIZED CONTEXT"}</DemoBadge>}/> : <header className="matt-heading"><div><span className="matt-eyebrow">MATT / YOUR OPERION COLLEAGUE</span><h1>Let's look at what matters.</h1><p>Ask. Investigate. Understand the evidence.</p></div>
      <span className="matt-provenance">{demo ? "DEMONSTRATION / PREPARED CONTRACT DATA" : "AUTHENTICATED / SELECTED CONTRACT SCOPE"}</span></header>}
    {studio && <div className="matt-studio-notice" role="status">{mediaStatus === "error" ? <VideoOff size={18} aria-hidden="true"/> : <Video size={18} aria-hidden="true"/>}<div>
      <strong>{live.connected ? `Live Matt: ${live.state.toLowerCase()}` : "One-time introduction / live connection"}</strong>
      <p>{live.connected ? "The approved provider receives the actual generated answer text and supplies both speech and video. Review the supporting evidence." : "Introduction footage is not an answer. Until live activation is approved, findings use the existing prepared or structured intelligence without spoken video responses."}</p>
    </div></div>}
    <div className={`matt-layout${studio && dossierOpen ? " has-proposal" : ""}`}>
      <div className="matt-video-column">
        <MattEnvironment introductionKey={demo ? "demo" : `user:${user?.id}`} phase={state.phase} onMediaError={onMediaError} onMediaStatus={onMediaStatus} stream={live.stream} live={live}/>
        <form className="matt-composer" onSubmit={submit}>
          <div className="matt-controls"><button type="button" disabled={microphoneState === "REQUESTING"} className={state.phase === "LISTENING" ? "is-recording" : ""} onClick={state.phase === "LISTENING" ? disableMicrophone : startListening} aria-pressed={state.phase === "LISTENING"}><Mic size={18}/>{state.phase === "LISTENING" ? "Stop microphone" : "Microphone"}</button>
            {microphoneEnabled && state.phase !== "LISTENING" && <button type="button" onClick={disableMicrophone}>Disable microphone</button>}
            <button type="button" onClick={interrupt}><Square size={16}/>Interrupt / stop</button>
            <button type="button" aria-controls={inputId} aria-expanded={showTextInput} onClick={() => setShowTextInput((open) => !open)}><Keyboard size={18}/>{showTextInput ? "Hide text input" : "Type a question"}</button>
          </div>
          {showTextInput && <div className="matt-text-input" id={inputId}><label>Ask Matt<textarea ref={composerRef} aria-label="Ask Matt" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={2} placeholder={contextMode === "platform" ? "Ask about Operion capabilities and navigation..." : "Ask about this context, or a previous finding..."}/></label>
            <small>{question.length}/500 characters. {live.connected ? "Final voice transcripts are sent to the authorized live conversation." : "Voice transcripts are reviewed before sending."}</small>
            <button type="submit" className="matt-send" disabled={question.trim().length < 3 || !canAsk}><ArrowUp size={18}/>Send</button></div>}
        </form>
        {live.connected && <div className="matt-controls matt-live-controls"><span role="status">Audio output: {live.audioState.toLowerCase()}. Device audibility is not independently verified.</span>{live.audioState === "ENABLED" ? <button type="button" onClick={live.muteAudio}>Mute Matt audio</button> : <button type="button" onClick={live.enableAudio}>Enable Matt audio</button>}<button type="button" onClick={async () => { await interrupt(); live.setConsent(false); }}>Disconnect live Matt</button></div>}
        <details className="matt-voice-settings"><summary>Voice and privacy settings</summary>
          <p role="status" data-microphone-state={microphoneState}>Microphone permission: {microphoneState.toLowerCase().replaceAll("_", " ")}. {realtimeSpeech ? `Real-time input: ${speechInputState.toLowerCase()}. Transmission continues during answers only while connected; disable the microphone to stop it.` : state.phase === "LISTENING" ? live.connected ? "Listening to captured audio for the live conversation." : "Listening for transcript review only; live Matt is not connected." : microphoneEnabled ? "Capture retained but paused; not listening." : "Microphone disabled."}</p>
          <button type="button" onClick={reset}><RotateCcw size={16}/>Clear conversation</button>
          <p>{realtimeSpeech ? "The approved OpenAI Realtime speech service receives continuous microphone audio until stopped or disconnected. Operion receives final transcripts and alone generates evidence-backed answers." : "Browser recognition may send microphone audio to its vendor's speech service."} Live answers and conversation text go to the approved model and avatar services. No browser voice synthesis is used for Matt's live responses. Enable only if your organization permits these services. Text findings work without them.</p>
          <label><input type="checkbox" checked={voiceConsent} onChange={(event) => { setVoiceConsent(event.target.checked); if (!event.target.checked) disableMicrophone(); }}/>{realtimeSpeech ? "I permit the approved real-time audio processor for this visit" : "I permit browser speech services for this visit"}</label>
          <p>{realtimeSpeech ? "Real-time input requires microphone access and WebRTC over HTTPS or localhost; actual browser/device compatibility remains subject to acceptance." : "Captured-track speech currently requires desktop Chrome or Edge 135+ on HTTPS. Other browsers can use typed questions."} Device permission is requested only when you click Microphone after acknowledging this notice. Tavus Text Echo receives answer text, not your microphone audio.</p>
          <p>{support.input ? realtimeSpeech ? "WebRTC speech input available; approval, permission and network still required." : "Browser speech recognition available; permission and network still required." : "Selected speech input unavailable in this browser: use text."} {live.connected ? "Live response speech and video use the same provider session." : "Live speech and video are not connected. The introduction will not be substituted for an answer."}</p>
        </details>
      </div>
      <section className={`matt-workspace${studio ? " od-card" : ""}`} aria-label="Matt conversation and findings">
        <section className="matt-question-panel" aria-label="Suggested questions"><span className="matt-eyebrow">{contextMode === "platform" ? "OPERION GUIDE" : contextMode === "account" ? "AUTHORIZED ACCOUNT" : flight ? "SELECTED AIRCRAFT" : "CONTRACT INTELLIGENCE"}</span><h2>Explore this context</h2>
          <div className="matt-studio-prompts" aria-label="Prepared intelligence questions">{suggestions.map((prompt) => <button type="button" key={prompt} disabled={busy || !canAsk} onClick={() => submit(null, prompt)}>{prompt}</button>)}</div>
        </section>
        <label className="matt-context">Question scope<select aria-label="Question scope" value={contextMode} onChange={(event) => {
          void interrupt(); setContextMode(event.target.value); onScopeChange?.(event.target.value);
        }}><option value="analysis">Selected contract or flight</option><option value="account">Authorized account</option><option value="platform">Operion guide</option></select></label>
        {studio && <div className="matt-studio-toolbar">
          <button type="button" aria-controls={dossierId} aria-expanded={dossierOpen} onClick={() => setDossierOpen((open) => !open)}><PanelRight size={18}/>{dossierOpen ? "Close findings" : "Inspect findings"}{result ? ` (${result.findings.length})` : ""}</button>
          <label><input type="checkbox" checked={showResponseText} onChange={(event) => { setShowResponseText(event.target.checked); if (event.target.checked) setDossierOpen(true); }}/>Show response text</label>
        </div>}
        {contextMode !== "analysis" ? <div className="matt-context"><p>{contextMode === "platform" ? "Reviewed Operion features, permissions and navigation. No contract, report or flight is retrieved for this scope." : demo ? "Prepared Demo account catalog and explicitly reused sample lease analysis only; not independent portfolio findings. Approved live reasoning is required." : "Current authorized account catalog and latest available OCI analysis per contract, bounded to 50 contracts and 200 runs. No inferred portfolio ranking, currency aggregation or overdue status. Approved live reasoning is required."}</p></div> : flight ? <div className="matt-context"><strong>{flight.flightNumber || flight.id} / {flight.origin} to {flight.destination}</strong><p>Illustrative flight only. Answers use this flight's scenario, not the demonstration lease or customer records.</p></div> : <div className="matt-context">
          <label>Contract context<select aria-label="Contract context" value={contractId} disabled={catalogState !== "ready"} onChange={(event) => changeContract(event.target.value)}>
            <option value="">Select an authorized contract</option>
            {catalog.filter((item) => item.id === contractId || (item.title || "").toLowerCase().includes(contractSearch.toLowerCase())).map((item) => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
          </select></label>
          <details className="matt-context-details"><summary>Scope and contract search</summary>
            <label>Search available contract names<input type="search" value={contractSearch} onChange={(event) => setContractSearch(event.target.value)} placeholder="Contract title"/></label>
            <p>{demo ? "Prepared contract-specific synthetic illustrations only, not independent real-world analyses. Navigation templates have no analysis or evidence. No customer records. Connecting live Matt requires approved external processing; without a connection, answers remain prepared demonstrations." : "Names come from your authorized organization catalog. Each question searches only the selected contract; no portfolio-wide ranking or automatic extraction."}</p>
          </details>
          {catalogState === "loading" && <p role="status">Loading available contract context...</p>}
          {scopeError && <p role="alert">{scopeError}</p>}
        </div>}
        <div className="matt-activity" role="status" aria-live="polite"><i aria-hidden="true"/><span>{state.activity}</span></div>
        {state.error && <p className="matt-error" role="alert">{state.error}</p>}
        {mediaError && <p className="matt-error" role="alert">{mediaError}</p>}
        {live.audioError && <p className="matt-error" role="alert">{live.audioError}</p>}
        {live.pendingApproval && <div className="matt-review" role="status"><p>This answer requires an estimated {live.pendingApproval.estimatedIntelligence} intelligence units. No model response has been generated for this request.</p><button type="button" onClick={() => submit(null, live.pendingApproval.question, true)}>Approve estimated generation</button></div>}
        <div id={dossierId} className="matt-report" aria-label="Intelligence report" hidden={studio && !dossierOpen}>
          {studio && <div className="matt-dossier-heading"><div><span className="matt-eyebrow">CONTEXTUAL INTELLIGENCE</span><h2>Findings and evidence</h2></div><button type="button" aria-label="Close findings panel" onClick={() => setDossierOpen(false)}>Close</button></div>}
          {result && (busy || state.error) && <p role="status">The retained report below is from the previous completed question, not the current request.</p>}
          {result?.analysisRunId && analysisScope && result.analysisRunId !== analysisScope && <p role="status">This retained report is from a different analysis version. Ask again to use the selected workspace version.</p>}
          {!result ? <div className="matt-welcome"><FileText size={28}/><h2>Evidence, not guesswork.</h2><p>Start with a contract question. Findings, source excerpts and follow-ups stay here beside Matt.</p>
            <div className="matt-prompts">{["What are the key obligations?", "Review the maintenance risks", "Which deadlines require trigger dates?"].map((prompt) => <button type="button" key={prompt} disabled={busy || !contractId} onClick={() => submit(null, prompt)}>{prompt}</button>)}</div></div>
            : <InfoCard as="article" className="matt-response-card" tone={result.established ? "neutral" : "warning"}><span className="matt-eyebrow">{result.source === "prepared_platform_guide" ? "REVIEWED OPERION GUIDE / NOT GENERATED AI" : demo ? "ILLUSTRATIVE FINDINGS / NOT VERIFIED CUSTOMER DATA" : result.source === "ai_gateway" ? "GENERATED INTERPRETATION / HUMAN REVIEW REQUIRED" : "EXISTING STRUCTURED INTELLIGENCE / HUMAN REVIEW REQUIRED"}</span>
              <h2>{result.contractTitle}</h2>{(!studio || showResponseText) && <p className="matt-answer">{result.answer}</p>}
              <p>{result.source === "prepared_platform_guide" ? "Reviewed product documentation, not contractual evidence or proof of operational provider readiness." : result.established ? result.source === "ai_gateway" ? "Source references passed identifier validation. Review the generated interpretation against the original evidence; this is not legal advice." : "Linked source evidence was supplied by the existing assistant; interpretation remains decision support, not legal advice." : "Not established. Do not infer that a clause, exposure or obligation exists."}</p>
              <ol className="matt-findings">{result.findings.map((finding) => <li key={`${finding.type}-${finding.id}`}>
                <button type="button" onClick={() => compose(`Explain ${finding.type}: ${finding.label}`.slice(0, 500))}><span>{finding.type}</span>{finding.label}</button>
              </li>)}</ol>
              <section className="matt-next-action"><h3>Recommended review action</h3><p>{result.established ? "Verify the cited source and its applicability, then confirm the relevant owner and timing before acting." : "Obtain the missing source evidence before treating this answer as an obligation or exposure."} This review suggestion is not an executed action or legal advice.</p></section>
              {result.reasoning?.length > 0 && <details><summary>{result.source === "ai_gateway" ? "Reasoning and source basis" : "How the prepared findings were selected"}</summary><ul>{result.reasoning.map((item) => <li key={item}>{item}</li>)}</ul></details>}
              {result.limitations?.length > 0 && <div className="matt-review"><h3>Data limitations</h3><ul>{result.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              <details onToggle={(event) => { if (event.currentTarget.open) dispatch({ type: "REVIEWED" }); }}><summary>Supporting source evidence ({result.evidence.length})</summary>
                {result.evidence.map((source, index) => studio ? <EvidenceCard key={source.id || index} evidence={{ excerpt: source.excerpt, page: source.page_number, locator: source.source_locator }}/>: <blockquote key={source.id || index}><p>{source.excerpt}</p><cite>{source.source_locator || (source.page_number ? `Page ${source.page_number}` : "Source locator unavailable")}</cite>
                  {source.confidence !== null && source.confidence !== undefined && <small>Source confidence: {source.confidence}. Not a liability estimate.</small>}</blockquote>)}
              </details>
              {studio ? <details className="matt-proposal-disclosure"><summary>Review actions and proposal</summary><MattProposal result={result} demo={demo} onCompose={compose}/></details> : <section className="matt-review"><h3>Exposure and next action</h3><p>No new financial exposure is calculated by this presentation. Amounts, exclusions and missing evidence require review in the existing contract intelligence.</p><p>Review the supplied source and verify timing/attribution before taking action. Matt does not send notices or change records.</p></section>}
              <div className="matt-report-actions"><button type="button" onClick={() => compose("Explain the second finding in more detail")}>Explain the second finding</button>
                <Link to={fullReport}>OPEN FULL REPORT</Link>{result.contractId && <Link to={`${base}/contracts/${encodeURIComponent(result.contractId)}${demo ? "/evidence" : "#evidence"}`}>Open existing contract workspace</Link>}</div>
              <div className="matt-report-actions" aria-label="Session-only response feedback">{["Helpful", "Needs review"].map((rating) => <button type="button" key={rating} aria-pressed={feedback[state.requestId] === rating} onClick={() => {
                const next = { ...session.feedback, [state.requestId]: rating }; session.feedback = next; setFeedback(next);
              }}>{rating}</button>)}<small>Feedback is retained in this session only, not submitted as approval.</small></div>
            </InfoCard>}
        </div>
        {(!studio || showResponseText) && <details className="matt-history"><summary>Conversation ({state.messages.length} messages, this visit only)</summary>{state.messages.map((message, index) => <p key={index}><strong>{message.role === "user" ? "You" : "Matt"}</strong> {message.text}</p>)}</details>}
      </section>
    </div>
  </main>;
}
