import React, { createContext, useContext } from "react";

const evidence = {
  lateReturn: { id: "ev-return", page: 89, locator: "Section 22.4 - Late Return", excerpt: "If the Lessee fails to return the Aircraft on or before the Termination Date, the Lessee shall pay to the Lessor a late return fee for each day of delay." },
  termination: { id: "ev-termination", page: 74, locator: "Section 18.2 - Termination Rights", excerpt: "The Lessor may terminate this Agreement immediately upon written notice if the Lessee fails to return the Aircraft within 30 days of the Termination Date." },
  insurance: { id: "ev-insurance", page: 42, locator: "Section 12.1 - Insurance", excerpt: "The Lessee shall maintain hull and liability insurance throughout the Term and provide evidence of renewal no later than fifteen days before expiry." },
  maintenance: { id: "ev-maintenance", page: 51, locator: "Section 14.3 - Maintenance Records", excerpt: "The Lessee shall maintain complete technical records and deliver updated records within ten Business Days following each shop visit." },
  payment: { id: "ev-payment", page: 18, locator: "Section 5.1 - Rent", excerpt: "Rent shall be paid monthly in advance on the first Business Day of each calendar month." },
};

const primaryContract = {
  id: "demo-aircraft-lease",
  title: "Aircraft Lease Agreement",
  contractId: "OPN-2025-00124",
  type: "Aircraft Operating Lease",
  status: "Active",
  counterparty: "Aviation Partners Ltd.",
  lessor: "Aviation Partners Ltd.",
  lessee: "Skyward Airlines",
  aircraft: { registration: "G-OPER", model: "B787-9", manufacturer: "Boeing" },
  effective: "01 Jan 2025",
  expiry: "31 Dec 2032",
  pages: 234,
  lastAnalysed: "02 Sep 2026",
  health: "High",
  clauses: [
    { id: "cl-return", number: "22.4", title: "Late Return", category: "Return Conditions", confidence: 0.97, risk: "Critical", text: evidence.lateReturn.excerpt, evidenceId: "ev-return" },
    { id: "cl-term", number: "18.2", title: "Termination Rights", category: "Termination", confidence: 0.95, risk: "High", text: evidence.termination.excerpt, evidenceId: "ev-termination" },
    { id: "cl-ins", number: "12.1", title: "Insurance Requirements", category: "Insurance", confidence: 0.98, risk: "Medium", text: evidence.insurance.excerpt, evidenceId: "ev-insurance" },
    { id: "cl-maint", number: "14.3", title: "Maintenance Records", category: "Maintenance", confidence: 0.96, risk: "High", text: evidence.maintenance.excerpt, evidenceId: "ev-maintenance" },
    { id: "cl-rent", number: "5.1", title: "Rent Payment", category: "Payment", confidence: 0.99, risk: "Low", text: evidence.payment.excerpt, evidenceId: "ev-payment" },
  ],
  obligations: [
    { id: "ob-ins", title: "Maintain insurance coverage", actor: "Lessee", action: "Maintain", object: "Hull and liability insurance", modality: "Mandatory", timing: "Throughout the Term", condition: "While aircraft is leased", frequency: "Continuous", confidence: 0.98, category: "Insurance", evidenceId: "ev-insurance", clauseId: "cl-ins" },
    { id: "ob-return", title: "Return aircraft in airworthy condition", actor: "Lessee", action: "Return", object: "Aircraft and records", modality: "Mandatory", timing: "On the Termination Date", condition: "At lease expiry or termination", frequency: "One-time", confidence: 0.97, category: "Redelivery", evidenceId: "ev-return", clauseId: "cl-return" },
    { id: "ob-records", title: "Provide maintenance records", actor: "Lessee", action: "Deliver", object: "Updated technical records", modality: "Conditional", timing: "Within 10 Business Days", condition: "Following each shop visit", frequency: "Event-based", confidence: 0.96, category: "Maintenance", evidenceId: "ev-maintenance", clauseId: "cl-maint" },
    { id: "ob-rent", title: "Pay rent monthly in advance", actor: "Lessee", action: "Pay", object: "Monthly rent", modality: "Mandatory", timing: "First Business Day", condition: "Each calendar month", frequency: "Monthly", confidence: 0.99, category: "Payment", evidenceId: "ev-payment", clauseId: "cl-rent" },
  ],
  deadlines: [
    { id: "dl-ins", title: "Insurance renewal evidence", type: "Relative", timing: "15 days before policy expiry", trigger: "Insurance policy expiry", condition: "During the lease term", status: "Upcoming", computability: "Computable when policy expiry is known", confidence: 0.96, evidenceId: "ev-insurance" },
    { id: "dl-records", title: "Maintenance records delivery", type: "Event-based", timing: "Within 10 Business Days", trigger: "Completion of shop visit", condition: "A shop visit has occurred", status: "Conditional", computability: "Requires trigger date", confidence: 0.95, evidenceId: "ev-maintenance" },
    { id: "dl-rent", title: "Monthly rent payment", type: "Recurring", timing: "First Business Day of each month", trigger: "Calendar month", condition: "During the lease term", status: "Recurring", computability: "Computable", confidence: 0.99, evidenceId: "ev-payment" },
    { id: "dl-return", title: "Aircraft redelivery", type: "Absolute", timing: "31 Dec 2032", trigger: "Termination Date", condition: "Unless terminated earlier", status: "Future", computability: "Computable", confidence: 0.97, evidenceId: "ev-return" },
  ],
  risks: [
    { id: "rk-return", title: "Late aircraft return", category: "Return Conditions", type: "Contractual default", severity: "Critical", confidence: 0.96, rationale: "Daily fees apply after the contractual return date and termination rights may follow.", consequence: "Late-return fees and potential termination.", financialExposure: "Unquantified", clauseId: "cl-return", obligationId: "ob-return", deadlineId: "dl-return", evidenceIds: ["ev-return", "ev-termination"] },
    { id: "rk-maint", title: "Incomplete maintenance records", category: "Maintenance", type: "Records compliance", severity: "High", confidence: 0.94, rationale: "Missing technical records may impair redelivery acceptance.", consequence: "Remediation costs and delayed acceptance.", financialExposure: "Unquantified", clauseId: "cl-maint", obligationId: "ob-records", deadlineId: "dl-records", evidenceIds: ["ev-maintenance"] },
    { id: "rk-ins", title: "Insurance evidence lapse", category: "Insurance", type: "Coverage evidence", severity: "Medium", confidence: 0.93, rationale: "Evidence must be provided before policy expiry.", consequence: "Potential contractual default.", financialExposure: "Unquantified", clauseId: "cl-ins", obligationId: "ob-ins", deadlineId: "dl-ins", evidenceIds: ["ev-insurance"] },
  ],
  evidence: Object.values(evidence),
};

export const DEMO_CONTRACTS = [
  primaryContract,
  { ...primaryContract, id: "demo-mro-agreement", contractId: "OPN-2026-00048", title: "Engine Maintenance Agreement", type: "MRO Agreement", counterparty: "Rolls-Royce plc", lessor: "Skyward Airlines", lessee: "Rolls-Royce plc", aircraft: { registration: "G-OPER", model: "Trent 1000", manufacturer: "Rolls-Royce" }, health: "Medium", status: "Active", lastAnalysed: "29 Aug 2026" },
  { ...primaryContract, id: "demo-insurance-agreement", contractId: "OPN-2025-00077", title: "Aviation Hull Insurance Agreement", type: "Insurance Agreement", counterparty: "AIG Aviation", lessor: "AIG Aviation", lessee: "Skyward Airlines", aircraft: { registration: "G-OPER", model: "B787-9", manufacturer: "Boeing" }, health: "High", status: "Active", lastAnalysed: "25 Aug 2026" },
  { ...primaryContract, id: "demo-ground-handling", contractId: "OPN-2026-00091", title: "Ground Handling Services Agreement", type: "Service Agreement", counterparty: "Dubai Aviation Services", aircraft: null, health: "Low", status: "Review", lastAnalysed: "18 Aug 2026" },
];

const DemoDataContext = createContext(null);

export function DemoDataProvider({ children }) {
  const value = {
    mode: "synthetic",
    sourceLabel: "DEMO DATA",
    contracts: DEMO_CONTRACTS,
    primaryContract,
    budget: { allocated: 5000, used: 1245, remaining: 3755, synthetic: true },
    getContract: (id) => DEMO_CONTRACTS.find((contract) => contract.id === id) || primaryContract,
    getEvidence: (id) => Object.values(evidence).find((item) => item.id === id),
  };
  return <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>;
}

export function useDemoData() {
  const context = useContext(DemoDataContext);
  if (!context) throw new Error("useDemoData must be used within DemoDataProvider");
  return context;
}
