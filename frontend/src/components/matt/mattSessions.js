import { useCallback, useSyncExternalStore } from "react";
import { INITIAL_MATT_STATE, mattReducer } from "./mattState";

const sessions = new Map();
function sessionFor(key) {
  if (!sessions.has(key)) sessions.set(key, { state: INITIAL_MATT_STATE, question: "", showText: false, listeners: new Set() });
  return sessions.get(key);
}
export function clearMattSessions() {
  for (const [key, session] of sessions) {
    session.controller?.abort();
    session.activeVoice?.stop();
    session.activeVoice = null;
    session.state = INITIAL_MATT_STATE;
    session.question = "";
    session.showText = false;
    session.feedback = {};
    session.listeners.forEach((listener) => listener());
    if (session.listeners.size === 0) sessions.delete(key);
  }
}
export function useMattSession(key) {
  const subscribe = useCallback((listener) => {
    const session = sessionFor(key);
    session.listeners.add(listener);
    return () => session.listeners.delete(listener);
  }, [key]);
  const snapshot = useCallback(() => sessionFor(key).state, [key]);
  const state = useSyncExternalStore(subscribe, snapshot);
  const dispatch = useCallback((event) => {
    const session = sessionFor(key);
    session.state = mattReducer(session.state, event);
    session.listeners.forEach((listener) => listener());
  }, [key]);
  return { state, dispatch, session: sessionFor(key) };
}
