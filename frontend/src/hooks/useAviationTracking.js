import { useEffect, useState } from "react";
import { listAircraft } from "../lib/aviationApi";

const POLL_INTERVAL_MS = 30_000;

export default function useAviationTracking(organizationId, companyOnly) {
  const [result, setResult] = useState({ state: "loading", provider: null, updatedAt: null, aircraft: [], error: null });

  useEffect(() => {
    if (!organizationId) {
      setResult({ state: "organization_required", provider: null, updatedAt: null, aircraft: [], error: null });
      return undefined;
    }
    let active = true;
    let timer;

    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await listAircraft(organizationId, { companyOnly });
        if (active) setResult({ state: response.state, provider: response.provider, updatedAt: response.updatedAt, aircraft: response.aircraft || [], error: null });
      } catch (error) {
        if (active) setResult((current) => ({ ...current, state: "error", error: error.message }));
      }
    }

    refresh();
    timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [organizationId, companyOnly]);

  return result;
}