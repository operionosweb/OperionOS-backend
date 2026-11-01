export const MATT_STATES = Object.freeze(["IDLE", "LISTENING", "PROCESSING", "INVESTIGATING", "SPEAKING", "PRESENTING", "INTERRUPTED", "ERROR", "SUCCESS"]);
export const INITIAL_MATT_STATE = { phase: "IDLE", activity: "Ready when you are.", requestId: null, result: null, messages: [], error: "" };

export function mattReducer(state, event) {
  if (event.requestId && event.type !== "REQUEST" && event.requestId !== state.requestId) return state;
  switch (event.type) {
    case "REQUEST": return { ...state, phase: "PROCESSING", activity: "Understanding your request; no new extraction is started.", requestId: event.requestId, error: "", messages: [...state.messages, { role: "user", text: event.question }].slice(-20) };
    case "OPERATION": return { ...state, phase: "INVESTIGATING", activity: event.activity };
    case "RESULT": return { ...state, phase: "PRESENTING", activity: "Findings received. Review their supporting evidence.", result: event.result, messages: [...state.messages, { role: "assistant", text: event.result.answer }].slice(-20) };
    case "REVIEWED": return ["SPEAKING", "LISTENING", "PROCESSING", "INVESTIGATING"].includes(state.phase) ? state : { ...state, phase: "SUCCESS", activity: "Evidence opened for review; not marked as legally verified." };
    case "LISTEN": return { ...state, phase: "LISTENING", activity: "Microphone active. Listening to your next request.", error: "" };
    case "TRANSCRIBED": return { ...state, phase: "IDLE", activity: "Transcript added to the composer. Review it, then send." };
    case "SPEECH_START": return { ...state, phase: "SPEAKING", activity: "Reading the received answer aloud." };
    case "SPEECH_END": return { ...state, phase: state.result ? "PRESENTING" : "IDLE", activity: "Speech finished. Ask a follow-up when ready." };
    case "INTERRUPT": return { ...state, phase: "INTERRUPTED", activity: "Interrupted. Conversation retained; ready for your next instruction.", requestId: null };
    case "ERROR": return { ...state, phase: "ERROR", activity: "This operation could not be completed.", error: event.error };
    case "READY": return { ...state, phase: state.result ? "PRESENTING" : "IDLE", activity: "Ready for text or an explicitly activated microphone." };
    case "RESET": return { ...INITIAL_MATT_STATE, messages: [] };
    default: return state;
  }
}

export function contextualQuestion(question, result) {
  const text = question.trim();
  const reference = /\b(first|second|third|fourth|1st|2nd|3rd|4th)\s+(finding|one|risk|obligation|clause|deadline|result|item)\b/i.exec(text);
  if (!reference) return text;
  const positions = { first: 0, second: 1, third: 2, fourth: 3, "1st": 0, "2nd": 1, "3rd": 2, "4th": 3 };
  const type = reference[2].toLowerCase();
  const findings = ["risk", "obligation", "clause", "deadline"].includes(type) ? result?.findings?.filter((item) => item.type === type) : result?.findings;
  const finding = findings?.[positions[reference[1].toLowerCase()]];
  if (!finding) throw new Error("That finding is not available in the current report. Select a finding or name the term you want to review.");
  const expanded = `${text} Regarding ${finding.type}: ${finding.label}`;
  if (expanded.length > 500) throw new Error("Please shorten this follow-up so its finding reference fits the existing assistant's 500-character limit.");
  return expanded;
}
