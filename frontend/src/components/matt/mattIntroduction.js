import { useCallback, useSyncExternalStore } from "react";

const introductions = new Map();
function entry(key) {
  if (!introductions.has(key)) {
    let completed = false, time = 0;
    try {
      completed = sessionStorage.getItem(`operion:matt:intro:${key}`) === "complete";
      const saved = Number(sessionStorage.getItem(`operion:matt:intro-progress:${key}`));
      if (Number.isFinite(saved) && saved > 0) time = saved;
    }
    catch (error) { console.warn("Matt introduction session storage unavailable; using visit memory", error.name); }
    introductions.set(key, { completed, time, owner: null, listeners: new Set(), revision: 0, warned: false });
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
    return () => value.listeners.delete(listener);
  }, [key]);
  const snapshot = useCallback(() => entry(key).revision, [key]);
  useSyncExternalStore(subscribe, snapshot);
  const value = entry(key);
  return {
    completed: value.completed,
    revision: value.revision,
    claim(owner) {
      if (value.completed || (value.owner && value.owner !== owner)) return false;
      value.owner = owner;
      return true;
    },
    resumeTime: () => value.time,
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
    complete() {
      value.completed = true;
      value.owner = null;
      try { sessionStorage.setItem(`operion:matt:intro:${key}`, "complete"); }
      catch (error) { console.warn("Matt introduction completion retained in visit memory only", error.name); }
      notify(value);
    },
  };
}
