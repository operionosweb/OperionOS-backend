import { useCallback, useSyncExternalStore } from "react";

const introductions = new Map();
const outcomes = ["intro_completed", "intro_skipped", "intro_disabled"];
const storageKey = (key) => `operion:matt:intro:${key}`;
function entry(key) {
  if (!introductions.has(key)) {
    let status = "intro_not_seen", time = 0;
    try {
      const stored = localStorage.getItem(storageKey(key));
      if (outcomes.includes(stored)) status = stored;
      else if (sessionStorage.getItem(storageKey(key)) === "complete") {
        status = "intro_completed";
        localStorage.setItem(storageKey(key), status);
      }
      const saved = Number(sessionStorage.getItem(`operion:matt:intro-progress:${key}`));
      if (Number.isFinite(saved) && saved > 0) time = saved;
    }
    catch (error) { console.warn("Matt introduction session storage unavailable; using visit memory", error.name); }
    introductions.set(key, { status, time, owner: null, listeners: new Set(), revision: 0, warned: false });
  }
  return introductions.get(key);
}
function notify(value) {
  value.revision++;
  value.listeners.forEach((listener) => listener());
}
export function useMattIntroduction(key) {
  const subscribe = useCallback((listener) => {
    const value = entry(key);
    value.listeners.add(listener);
    const changed = (event) => {
      if (event.key !== storageKey(key) || !outcomes.includes(event.newValue)) return;
      value.status = event.newValue;
      value.owner = null;
      notify(value);
    };
    window.addEventListener("storage", changed);
    return () => { value.listeners.delete(listener); window.removeEventListener("storage", changed); };
  }, [key]);
  const snapshot = useCallback(() => entry(key).revision, [key]);
  useSyncExternalStore(subscribe, snapshot);
  const value = entry(key);
  return {
    completed: outcomes.includes(value.status),
    state: outcomes.includes(value.status) ? "assistant_ready" : value.status,
    outcome: value.status,
    revision: value.revision,
    available: (owner) => !value.owner || value.owner === owner,
    claim(owner) {
      if (outcomes.includes(value.status) || (value.owner && value.owner !== owner)) return false;
      value.owner = owner;
      return true;
    },
    resumeTime: () => value.time,
    playing() {
      if (value.status !== "intro_not_seen") return;
      value.status = "intro_playing";
      notify(value);
    },
    checkpoint(time) {
      if (!Number.isFinite(time) || time < value.time + 1) return;
      value.time = time;
      try { sessionStorage.setItem(`operion:matt:intro-progress:${key}`, String(time)); }
      catch (error) {
        if (!value.warned) console.warn("Matt introduction progress retained in visit memory only", error.name);
        value.warned = true;
      }
    },
    release(owner, time) {
      if (value.owner !== owner) return;
      value.time = Number.isFinite(time) ? time : value.time;
      value.owner = null;
      notify(value);
    },
    complete(outcome = "intro_completed") {
      if (!outcomes.includes(outcome)) throw new Error("Invalid Matt introduction outcome.");
      value.status = outcome;
      value.owner = null;
      try { localStorage.setItem(storageKey(key), outcome); }
      catch (error) { console.warn("Matt introduction completion retained in visit memory only", error.name); }
      notify(value);
    },
  };
}
