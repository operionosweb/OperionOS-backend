import React, { useState } from "react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Container } from "../components/ui/Layout";
import Reveal from "../components/ui/Reveal";
import { trackEvent } from "../components/analytics/Analytics";
import { apiRequest } from "../lib/apiClient";

const ROLES = ["Executive / Management", "Legal", "Finance", "Procurement", "Operations", "Risk", "Other"];
const ORGANISATIONS = ["Airline", "Aircraft Leasing", "MRO", "Ground Handling", "Aviation Services", "Consultancy", "Other"];
const INTERESTS = ["Contract Intelligence", "Financial Exposure", "Risk & Recommendations", "Predictive Intelligence", "Other"];
const NEXT_STEPS = ["We review your requirements.", "We arrange a private Operion demonstration.", "We show how Operion can be applied to your aviation environment.", "If appropriate, we discuss a pilot."];
const CONTACT_IMAGE = "https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=2000&q=82";

export default function RequestDemo() {
  const [status, setStatus] = useState("idle");

  const submitRequest = async (event) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const payload = Object.fromEntries(form.entries());
    setStatus("submitting");

    try {
      await apiRequest("/api/contact", { method: "POST", body: payload });
      trackEvent("request_demo_submit", { company_type: payload.companyType, interest: payload.interest });
      element.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return <main className="op-request-page">
    <section className="op-request-hero op-cinematic-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(4, 22, 37, .94), rgba(4, 29, 45, .62)), url(${CONTACT_IMAGE})` }}><Container><Reveal><p className="op-sales-label">PRIVATE DEMONSTRATION</p><h1>See What Operion Can Find in Your Contracts</h1><p>Request a private demonstration of Operion's Contract Intelligence platform for aviation.</p></Reveal></Container></section>
    <section className="op-request-section"><Container><div className="op-request-grid">
      <Reveal><form className="op-request-form" onSubmit={submitRequest}><div className="op-request-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" /></label></div><div className="op-request-form-grid"><label>Name<input name="name" autoComplete="name" minLength="2" maxLength="80" required /></label><label>Work email<input name="email" type="email" autoComplete="email" maxLength="254" required /></label><label>Company<input name="company" autoComplete="organization" minLength="2" maxLength="120" required /></label><label>Role<select name="role" required defaultValue=""><option value="" disabled>Select role</option>{ROLES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Company type<select name="companyType" required defaultValue=""><option value="" disabled>Select company type</option>{ORGANISATIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>What would you like to explore?<select name="interest" defaultValue=""><option value="">Select an area (optional)</option>{INTERESTS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="op-request-message">Message<textarea name="message" rows="5" maxLength="2000" /></label></div><button className="op-btn op-btn-primary" type="submit" disabled={status === "submitting"}>{status === "submitting" ? "Sending request…" : "Request Private Demo"} <ArrowRight size={16} /></button><p className="op-request-privacy"><Mail size={14} />Operion uses these details only to respond to your request.</p>{status === "success" && <p className="op-request-status" role="status"><Check size={15} /><span><strong>Thank you.</strong> Your request has been received. We will be in touch shortly.</span></p>}{status === "error" && <p className="op-request-status is-error" role="alert">Something went wrong. Please try again or contact us directly at <a href="mailto:info@operionos.com">info@operionos.com</a>.</p>}</form></Reveal>
      <Reveal className="op-request-next"><p className="op-sales-label">WHAT HAPPENS NEXT?</p><ol>{NEXT_STEPS.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>)}</ol><div><strong>A focused conversation.</strong><p>No generic sales presentation. The demonstration is shaped around your organisation, contracts and priorities.</p><a className="op-request-email" href="mailto:info@operionos.com">info@operionos.com</a></div></Reveal>
    </div></Container></section>
  </main>;
}
