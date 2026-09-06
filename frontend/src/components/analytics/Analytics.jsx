import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const MEASUREMENT_ID = "G-KJRS5DWVD4";
const CONSENT_KEY = "operion-analytics-consent";

function loadAnalytics() {
  if (document.querySelector("script[data-operion-ga4]")) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("consent", "default", { analytics_storage: "granted" });
  window.gtag("config", MEASUREMENT_ID, { send_page_view: false, anonymize_ip: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  script.dataset.operionGa4 = "true";
  document.head.appendChild(script);
}

export function trackEvent(name, parameters = {}) {
  if (localStorage.getItem(CONSENT_KEY) !== "granted") return;
  loadAnalytics();
  window.gtag("event", name, parameters);
}

export function openAnalyticsPreferences() {
  window.dispatchEvent(new Event("operion:analytics-preferences"));
}

export default function Analytics() {
  const { pathname, search } = useLocation();
  const [consent, setConsent] = useState(() => localStorage.getItem(CONSENT_KEY));
  const [preferencesOpen, setPreferencesOpen] = useState(() => consent === null);

  useEffect(() => {
    const openPreferences = () => setPreferencesOpen(true);
    window.addEventListener("operion:analytics-preferences", openPreferences);
    return () => window.removeEventListener("operion:analytics-preferences", openPreferences);
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    loadAnalytics();
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: `${pathname}${search}`,
      page_title: document.title,
    });
    const activeVideo = document.querySelector(".op-intel-video-frame video");
    if (activeVideo && !activeVideo.paused && activeVideo.readyState >= 2) {
      window.gtag("event", "video_play", { video_title: "Operion home" });
    }
  }, [consent, pathname, search]);

  const chooseConsent = (value) => {
    localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
    setPreferencesOpen(false);
  };

  if (!preferencesOpen) return null;
  return <aside className="op-consent" aria-label="Analytics preferences"><div><strong>Analytics preferences</strong><p>Allow anonymous usage analytics to help Operion understand page engagement and demo interest. The site works without analytics.</p></div><div><button type="button" className="op-btn op-btn-secondary" onClick={() => chooseConsent("denied")}>Decline</button><button type="button" className="op-btn op-btn-primary" onClick={() => chooseConsent("granted")}>Allow analytics</button></div></aside>;
}