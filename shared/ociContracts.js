// Browser-safe OCI form contract. PATCH replaces business data; omitted geography/provenance and links are preserved.
import { OCI_AVIATION_SEGMENTS, OCI_COMPANY_TYPES, OCI_DEFAULT_MARKET, OCI_GEOGRAPHIC_SCOPES } from "./ociGeography.js";
import { OCI_ACCOUNT_FIT_CRITERIA, OCI_ACCOUNT_FIT_RATINGS } from "./ociAccountFit.js";
export { OCI_DEFAULT_MARKET };
export const OCI_STAGES = [
  "Target identified", "Research completed", "Initial contact", "Discovery scheduled",
  "Discovery completed", "Qualified", "Product demonstration", "Pilot proposed",
  "Commercial negotiation", "On hold", "Won", "Lost",
  "Identified", "Researched", "Contacted", "Engaged", "Discovery meeting",
  "Pilot active", "Proposal submitted", "Negotiation", "Nurture",
];
export const OCI_DECISION_DEPARTMENTS = Object.freeze([
  "Legal / contract management", "Procurement", "CFO / Finance", "Operations",
  "Maintenance", "Fleet management", "Risk management", "Digital transformation",
  "IT / AI leadership", "Executive management",
]);
export const OCI_PILOT_DISCLAIMER = "Manual commercial planning only. Scope and deliverables require human verification against currently implemented product capabilities; no customer contract contents belong in OCI.";
const field = (key, label, type = "text", extra = {}) => ({ key, label, type, ...extra });
const text = (key, label, required = false, extra = {}) => field(key, label, "text", { required, max: 240, ...extra });
const notes = (key, label, required = false, extra = {}) => field(key, label, "textarea", { required, max: 4000, ...extra });
const select = (key, label, options, required = false, extra = {}) => field(key, label, "select", { options, required, ...extra });
const number = (key, label, max = 1e12) => field(key, label, "number", { min: 0, max });
const date = (key, label, required = false) => field(key, label, "date", { required });
const url = (key, label) => field(key, label, "url", { max: 2000 });
const segments = OCI_AVIATION_SEGMENTS;
const evidence = [
  select("classification", "Evidence classification", ["Verified fact", "Research finding", "Assumption", "AI-generated hypothesis"], true),
  notes("source", "Professional/public source and evidence references"),
  date("researchDate", "Research date"),
  select("confidence", "Confidence", ["Low", "Medium", "High"]),
];
const next = [notes("nextAction", "Next action"), date("followUpDate", "Follow-up date")];
const money = [text("currency", "ISO 4217 currency", true)];
const geographicLocation = [
  text("country_code", "Country code (ISO alpha-2; GB for UK)"),
  text("administrative_region", "Administrative region"),
  text("city", "City"), text("airport_iata", "Airport IATA identifier"),
  text("airport_icao", "Airport ICAO identifier"),
  notes("geographic_source", "Geographic source or reference"),
  select("geographic_confidence", "Geographic confidence", ["Low", "Medium", "High"]),
];
export const OCI_MODULES = [
  { id: "accounts", label: "Accounts", description: "Aviation organisation research; public commercial information only.", fields: [
    text("name", "Organisation name", true), url("website", "Website"), text("country", "Country"), text("location", "Location"),
    text("headquarters", "Headquarters"), notes("operationalLocations", "Operational locations and evidence"),
    select("segment", "Aviation segment", segments), select("company_type", "Company type", OCI_COMPANY_TYPES),
    notes("description", "Organisation description"), notes("fleetPortfolio", "Fleet / aircraft portfolio and source"),
    notes("contractActivities", "Contract-intensive activities and source"), notes("contractUseCases", "Potential Contract Intelligence use cases and basis"),
    notes("decisionDepartments", "Potential decision-making departments and basis"),
    number("companySize", "Verified company size", 1e8),
    notes("companySizeEvidence", "Company size verification evidence"), select("priority", "Priority", ["Low", "Medium", "High"]),
    select("accountStatus", "Account status", ["Target", "Researched", "Qualified", "Engaged", "Customer", "Nurture", "Lost"]),
    select("researchStatus", "Research status", ["Not researched", "In progress", "Researched", "Needs verification"]),
    select("stakeholderDepartment", "Priority decision-making department", OCI_DECISION_DEPARTMENTS),
    select("stakeholderStatus", "Stakeholder evidence status", ["Verified contact recorded", "Publicly identified person", "Hypothesised buying role", "Unknown stakeholder"]),
    notes("stakeholderEvidence", "Stakeholder source or hypothesis rationale"),
    ...OCI_ACCOUNT_FIT_CRITERIA.map(criterion => select(criterion.key, criterion.label, OCI_ACCOUNT_FIT_RATINGS)),
    notes("fitEvidence", "Account-fit evidence and rationale (cite each assessed criterion)"),
    notes("needs", "Identified needs"), ...evidence, notes("researchNotes", "Research notes"), notes("relationshipHistory", "Relationship history"), ...next,
  ] },
  { id: "contacts", label: "Contacts", description: "Minimised, lawfully obtained professional contact information; account link required.", fields: [
    text("name", "Name", true), text("jobTitle", "Job title"), field("email", "Professional email", "email", { max: 254 }),
    text("phone", "Professional phone"), url("linkedinUrl", "LinkedIn URL"), text("decisionRole", "Decision-making role"),
    select("decisionDepartment", "Decision-making department", OCI_DECISION_DEPARTMENTS),
    select("identityStatus", "Person identification status", ["Verified contact", "Publicly identified person"]),
    select("relationshipStatus", "Relationship status", ["Identified", "Contacted", "Engaged", "Inactive"]),
    date("lastInteraction", "Last interaction"), ...next, notes("notes", "Professional notes"),
    notes("source", "Lawfully obtained professional source", true),
    select("lawfulBasis", "GDPR lawful basis", ["Consent", "Legitimate interests", "Contract"], true),
    notes("lawfulBasisDetails", "Consent or legitimate-interest assessment", true),
    date("retentionReviewDate", "Retention review date", true),
  ] },
  { id: "market", label: "Market intelligence", description: "Evidence-labelled aviation market and competitor research; no invented statistics.", fields: [
    text("title", "Research title", true), select("segment", "Market segment", segments), text("geography", "Geographic market"),
    select("researchStatus", "Research status", ["Not researched", "In progress", "Researched", "Needs verification"]),
    notes("opportunity", "Opportunity description"), notes("customerProblems", "Customer problems"),
    select("urgency", "Commercial urgency", ["Low", "Medium", "High"]), notes("buyingPotential", "Estimated buying potential and assumptions"),
    notes("competitors", "Competitor intelligence"), ...evidence, ...next,
  ] },
  { id: "opportunities", label: "Sales opportunities", description: "Manual pipeline with transparent probability assumptions; account link required.", fields: [
    text("name", "Opportunity name", true), select("stage", "Stage", OCI_STAGES, true),
    text("opportunityOwner", "Internal opportunity owner (name or role)"),
    number("value", "Estimated opportunity value"), ...money,
    date("expectedDecisionDate", "Expected customer decision date"), date("expectedCloseDate", "Legacy expected close date"),
    date("lastInteraction", "Last interaction"), number("probability", "Manual probability (%)", 100),
    notes("probabilityAssumptions", "Manual probability assumptions"), notes("problem", "Main problem"), notes("stakeholders", "Customer stakeholders"),
    notes("sourceEvidence", "Opportunity source and evidence"),
    notes("stageChangeEvidence", "Evidence or rationale for this stage change"),
    notes("lossReason", "Reason lost (required for Lost)"), notes("holdReason", "Reason on hold (required for On hold)"),
    ...next, notes("objections", "Objections"), notes("competitors", "Competitors"), notes("activityHistory", "Activity history"),
  ] },
  { id: "activities", label: "Activities", description: "Human-recorded meetings and follow-ups; no automatic outreach.", fields: [
    text("title", "Activity title", true), select("type", "Activity type", ["Meeting", "Call", "Email", "Research", "Follow-up", "Other"], true),
    date("dueDate", "Due date"), select("activityStatus", "Activity status", ["Planned", "Completed", "Cancelled"], true),
    select("actionStatus", "Execution status", ["Accepted", "In progress", "Completed", "Dismissed", "Snoozed"]),
    select("actionCategory", "Action category", ["Research", "Contact", "Discovery", "Opportunity", "Pilot / proposal", "Follow-up", "Other"]),
    text("recommendationId", "Recommendation identity", false, { readOnly: true }),
    notes("recommendationReason", "Recommendation rationale", false, { readOnly: true }),
    notes("recommendationEvidence", "Recommendation evidence and source", false, { readOnly: true }),
    notes("expectedObjective", "Expected commercial objective", false, { readOnly: true }),
    select("relatedRecordKind", "Related source record kind", ["accounts", "contacts", "market", "opportunities", "activities", "discovery", "pilots"], false, { readOnly: true }),
    text("relatedRecordId", "Related source record ID", false, { readOnly: true }),
    select("actionScope", "Action geographic scope", ["Account geography", "Global"]),
    notes("dismissalReason", "Reason for dismissal"),
    date("reviewDate", "Snoozed action review date"),
    date("completedDate", "Action completion date"),
    select("responseStatus", "External response status", ["Not waiting", "Awaiting external response", "Response received"]),
    notes("actionHistory", "Action status history", false, { internalOnly: true }),
    notes("outcome", "Outcome"), ...next,
  ] },
  { id: "discovery", label: "Customer discovery", description: "Commercial interviews without customer documents; account link required.", fields: [
    text("title", "Interview title", true), select("segment", "Customer segment", segments), date("interviewDate", "Interview date"),
    select("discoveryStatus", "Discovery status", ["Preparing", "Interview scheduled", "Interview completed", "Validated", "Needs follow-up"]),
    notes("researchReference", "Linked market research reference (not customer validation)"),
    notes("participants", "Interview participants"), notes("problems", "Problems identified"), notes("existingSolutions", "Existing solutions"),
    notes("currentProcess", "Current process"), select("painSeverity", "Pain severity", ["Low", "Medium", "High"]),
    notes("impact", "Financial or operational impact"), notes("purchasingAuthority", "Purchasing authority"),
    notes("budgetSignals", "Buying signals / budget signals"), notes("buyingTimeline", "Buying timeline"), notes("requirements", "Product requirements"),
    notes("contractIntelligenceNeeds", "Contract Intelligence needs described by the interviewee"),
    notes("objections", "Objections"), notes("validatedUseCases", "Validated use cases"),
    select("validation", "Validation classification", ["Customer-validated", "Internal assumption"], true), notes("validationEvidence", "Validation evidence"), ...next,
  ] },
  { id: "pilots", label: "Pilots and proposals", description: OCI_PILOT_DISCLAIMER, fields: [
    text("name", "Pilot/proposal name", true), select("offerType", "Offer type", ["Pilot", "Proposal"], true),
    notes("customerProblem", "Customer problem supported by discovery evidence"),
    notes("contractUseCase", "Contract Intelligence use case"),
    notes("scope", "Proposed pilot scope"), notes("contractCategories", "Contract categories"), number("documentCount", "Contract portfolio size supplied by customer", 1e8),
    notes("documentAssumptions", "Document size and complexity assumptions"), notes("deliverables", "Agreed deliverables"),
    number("durationDays", "Duration (days)", 3650), number("price", "Commercial price"), number("deliveryCost", "Estimated delivery cost"), ...money,
    notes("successCriteria", "Measurable success criteria"), notes("customerDecisionMaker", "Customer decision-maker (cite linked contact/evidence)"),
    date("expectedStartDate", "Expected start date"), notes("conversionBarriers", "Conversion barriers"),
    select("proposalStatus", "Proposal status", ["Not started", "Draft", "Internal review", "Awaiting customer", "Accepted", "Declined"]),
    select("approvalStatus", "Internal approval status", ["Not requested", "Pending internal approval", "Approved", "Rejected"]),
    notes("approvalEvidence", "Internal approval reference or rationale"),
    notes("priceEvidence", "Commercial price basis (planning only; not a customer commitment)"),
    notes("customerDecisionEvidence", "Evidence of customer decision or commitment"),
    notes("dataProtection", "Data protection requirements"),
    select("pilotStatus", "Status", ["Draft", "Proposed", "Active", "Completed", "Converted", "Cancelled"], true),
    number("conversionProbability", "Manual conversion potential (%)", 100), notes("conversionAssumptions", "Conversion assumptions"),
    notes("results", "Results"), notes("feedback", "Feedback"), notes("capabilityVerification", "Human capability verification", true), ...next,
  ] },
  { id: "revenue", label: "Revenue intelligence", description: "Actuals and forecasts are separate and grouped by currency; account link required.", fields: [
    text("name", "Revenue entry name", true), select("basis", "Financial basis", ["Actual", "Forecast"], true),
    select("revenueClass", "Revenue classification", ["Recognised actual", "Contracted future", "Committed pilot", "Speculative forecast", "Unclassified legacy"], true),
    select("revenueType", "Revenue type", ["Pilot", "Subscription", "Other"], true), ...money,
    field("amount", "Period revenue amount", "number", { min: 0, max: 1e12, required: true }),
    select("costBasis", "Cost assessment (explicit zeros required for assessed costs)", ["Unassessed", "Estimated", "Recorded"], true),
    number("annualContractValue", "Expected annual contract value"), number("mrr", "Monthly recurring revenue"), number("arr", "Annual recurring revenue"),
    number("deliveryCost", "Delivery cost"), number("acquisitionCost", "Customer acquisition cost"),
    number("infrastructureCost", "Infrastructure cost"), number("aiProcessingCost", "AI processing cost"), number("storageCost", "Storage cost"),
    number("documentVolume", "Contract/document volume", 1e8), number("intelligencePoints", "Intelligence point consumption"),
    number("lifetimeValue", "Customer lifetime value"), notes("assumptions", "Financial and volume assumptions"),
    date("periodDate", "Financial period date", true), notes("source", "Financial evidence/source"),
  ] },
].map(module => ({ ...module, fields: [
  ...module.fields,
  ...(["accounts", "market"].includes(module.id) ? geographicLocation : []),
  ...(module.id === "market" ? [select("market_region", "Research coverage scope", Object.keys(OCI_GEOGRAPHIC_SCOPES))] : []),
  select("data_origin", "Record provenance", ["Real", "Synthetic", "Unclassified"]),
] }));
