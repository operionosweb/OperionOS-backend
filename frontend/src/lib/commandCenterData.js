export const COMMAND_CENTER_METRICS = [
  ["CONTRACTS MONITORED", "247", "+12 this month", "neutral"],
  ["ACTIVE OBLIGATIONS", "1,842", "+12 detected", "positive"],
  ["AT-RISK OBLIGATIONS", "18", "3 critical changes / 24h", "warning"],
  ["OPEN EXPOSURE", "€12.4M", "€620K newly identified", "critical"],
  ["UPCOMING DEADLINES", "31", "7 due this week", "warning"],
  ["OPERATIONAL EVENTS", "07", "2 contractual signals", "positive"],
];

export const EXPOSURE_CATEGORIES = [
  ["Liquidated Damages", "€4.8M", 78, "3 contracts", "Potential"],
  ["SLA Penalties", "€2.4M", 55, "9 contracts", "Potential"],
  ["Delivery", "€1.8M", 42, "6 contracts", "Confirmed"],
  ["Fuel / Variable Pricing", "€1.2M", 31, "14 contracts", "Potential"],
  ["Regulatory", "€820K", 22, "4 contracts", "Potential"],
  ["Lease / Return", "€640K", 17, "3 contracts", "Confirmed"],
  ["Supplier", "€520K", 14, "12 contracts", "Potential"],
  ["Passenger / Compensation", "€220K", 8, "5 contracts", "Potential"],
];

export const OBLIGATION_WATCH = [
  { id: "obligation-return-inspection", status: "AT RISK", obligation: "Return inspection", contract: "A320 Lease Agreement", counterparty: "Northstar Aviation Leasing", asset: "Aircraft EC-MXA", owner: "Fleet Operations", trigger: "Lease expiry", due: "12 Sep 2026", consequence: "€1.2M", confidence: "97%", evidence: "Clause 12.1 · Return condition", contractId: "demo-aircraft-lease" },
  { id: "obligation-maintenance-records", status: "DUE SOON", obligation: "Engine maintenance notification", contract: "Engine MRO Framework", counterparty: "Summit Maintenance Services", asset: "Fleet technical", owner: "Engineering", trigger: "Usage threshold", due: "03 Sep 2026", consequence: "€240K", confidence: "94%", evidence: "Clause 6.3 · Parts and warranty records", contractId: "demo-mro-agreement" },
  { id: "obligation-insurance", status: "TRIGGERED", obligation: "Delay compensation", contract: "Ground Handling Agreement", counterparty: "Harbour Airport Services", asset: "FRA Operations", owner: "Airport Operations", trigger: "Delay > 3h", due: "Today", consequence: "€86K", confidence: "99%", evidence: "Clause 5.2 · Performance review", contractId: "demo-ground-handling" },
  { id: "obligation-turnaround", status: "OVERDUE", obligation: "Maintenance record submission", contract: "MRO Master Agreement", counterparty: "Summit Maintenance Services", asset: "A320-214 / EC-MXA", owner: "Engineering", trigger: "Maintenance event", due: "28 Aug 2026", consequence: "Service restriction", confidence: "91%", evidence: "Clause 4.1 · Turnaround service level", contractId: "demo-mro-agreement" },
];

export const INTELLIGENCE_FEED = [
  ["MARKET", "Jet-A1 price movement detected", "08:52 UTC", "14 variable-price contracts potentially affected", "warning"],
  ["SUPPLIER", "Engine component delivery delay detected", "08:29 UTC", "Potential €640K exposure", "critical"],
  ["OPERATION", "Aircraft rotation disruption detected", "08:11 UTC", "Ground Handling SLA threshold", "warning"],
  ["CONTRACT", "New indemnification variance identified", "07:54 UTC", "AeroNorth MRO Agreement", "neutral"],
];

export const CONTRACT_ACTIVITY = [
  ["AeroNorth Aircraft Lease Agreement", "Clause updated", "REVIEW REQUIRED", "12 min ago", "+1 risk", "demo-aircraft-lease"],
  ["AeroNorth MRO Services Agreement", "New obligation extracted", "MONITORED", "38 min ago", "No change", "demo-mro-agreement"],
  ["AeroNorth Ground Handling Agreement", "Potential breach detected", "AT RISK", "1h ago", "+2 risks", "demo-ground-handling"],
];

export const COMMAND_ANSWERS = {
  "What happens if fuel prices increase 30%?": "The prepared demo contains 5 fuel-related agreements in the exposure model. Review escalation and indexation clauses before modelling a 30% change.",
  "Which contracts are affected by the A320 delivery delay?": "The Airbus OEM Supply Agreement is the primary affected contract in this scenario. Clause 14.3 contains the liquidated damages signal for review.",
  "Show all obligations due within 14 days.": "2 obligations require attention within the next 14 days: Return inspection and Maintenance record submission.",
  "What is our current exposure to supplier delays?": "Supplier Agreements represent €1.12M of monitored exposure across 12 contracts, with 3 changes identified in the last 24 hours.",
};
