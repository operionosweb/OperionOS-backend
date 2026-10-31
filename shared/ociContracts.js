// Browser-safe OCI form contract. PATCH replaces data in full; omitted links are preserved.
export const OCI_STAGES = ["Identified", "Researched", "Qualified", "Contacted", "Engaged", "Discovery meeting", "Product demonstration", "Pilot proposed", "Pilot active", "Proposal submitted", "Negotiation", "Won", "Lost", "Nurture"];
export const OCI_PILOT_DISCLAIMER = "Manual commercial planning only. Scope and deliverables require human verification against currently implemented product capabilities; no customer contract contents belong in OCI.";
const field = (key, label, type = "text", extra = {}) => ({ key, label, type, ...extra });
const text = (key, label, required = false) => field(key, label, "text", { required, max: 240 });
const notes = (key, label, required = false) => field(key, label, "textarea", { required, max: 4000 });
const select = (key, label, options, required = false) => field(key, label, "select", { options, required });
const number = (key, label, max = 1e12) => field(key, label, "number", { min: 0, max });
const date = (key, label, required = false) => field(key, label, "date", { required });
const url = (key, label) => field(key, label, "url", { max: 2000 });
const segments = ["Airline", "Aircraft lessor", "MRO", "Aviation consultancy", "Ground handling", "Airport operator", "Other"];
const evidence = [
  select("classification", "Evidence classification", ["Verified fact", "Research finding", "Assumption", "AI-generated hypothesis"], true),
  notes("source", "Professional/public source and evidence references"),
  date("researchDate", "Research date"),
  select("confidence", "Confidence", ["Low", "Medium", "High"]),
];
const next = [notes("nextAction", "Next action"), date("followUpDate", "Follow-up date")];
const money = [text("currency", "ISO 4217 currency", true)];
export const OCI_MODULES = [
  { id: "accounts", label: "Accounts", description: "Aviation organisation research; public commercial information only.", fields: [
    text("name", "Organisation name", true), url("website", "Website"), text("country", "Country"), text("location", "Location"),
    select("segment", "Aviation segment", segments), notes("description", "Organisation description"), number("companySize", "Verified company size", 1e8),
    notes("companySizeEvidence", "Company size verification evidence"), select("priority", "Priority", ["Low", "Medium", "High"]),
    select("accountStatus", "Account status", ["Target", "Researched", "Qualified", "Engaged", "Customer", "Nurture", "Lost"]),
    notes("needs", "Identified needs"), ...evidence, notes("researchNotes", "Research notes"), notes("relationshipHistory", "Relationship history"), ...next,
  ] },
  { id: "contacts", label: "Contacts", description: "Minimised, lawfully obtained professional contact information; account link required.", fields: [
    text("name", "Name", true), text("jobTitle", "Job title"), field("email", "Professional email", "email", { max: 254 }),
    text("phone", "Professional phone"), url("linkedinUrl", "LinkedIn URL"), text("decisionRole", "Decision-making role"),
    select("relationshipStatus", "Relationship status", ["Identified", "Contacted", "Engaged", "Inactive"]),
    date("lastInteraction", "Last interaction"), ...next, notes("notes", "Professional notes"),
    notes("source", "Lawfully obtained professional source", true),
    select("lawfulBasis", "GDPR lawful basis", ["Consent", "Legitimate interests", "Contract"], true),
    notes("lawfulBasisDetails", "Consent or legitimate-interest assessment", true),
    date("retentionReviewDate", "Retention review date", true),
  ] },
  { id: "market", label: "Market intelligence", description: "Evidence-labelled aviation market and competitor research; no invented statistics.", fields: [
    text("title", "Research title", true), select("segment", "Market segment", segments), text("geography", "Geographic market"),
    notes("opportunity", "Opportunity description"), notes("customerProblems", "Customer problems"),
    select("urgency", "Commercial urgency", ["Low", "Medium", "High"]), notes("buyingPotential", "Estimated buying potential and assumptions"),
    notes("competitors", "Competitor intelligence"), ...evidence, ...next,
  ] },
  { id: "opportunities", label: "Sales opportunities", description: "Manual pipeline with transparent probability assumptions; account link required.", fields: [
    text("name", "Opportunity name", true), select("stage", "Stage", OCI_STAGES, true), number("value", "Opportunity value"), ...money,
    date("expectedCloseDate", "Expected close date"), number("probability", "Manual probability (%)", 100),
    notes("probabilityAssumptions", "Manual probability assumptions"), notes("problem", "Main problem"), notes("stakeholders", "Customer stakeholders"),
    ...next, notes("objections", "Objections"), notes("competitors", "Competitors"), notes("activityHistory", "Activity history"),
  ] },
  { id: "activities", label: "Activities", description: "Human-recorded meetings and follow-ups; no automatic outreach.", fields: [
    text("title", "Activity title", true), select("type", "Activity type", ["Meeting", "Call", "Email", "Research", "Follow-up", "Other"], true),
    date("dueDate", "Due date"), select("activityStatus", "Activity status", ["Planned", "Completed", "Cancelled"], true),
    notes("outcome", "Outcome"), ...next,
  ] },
  { id: "discovery", label: "Customer discovery", description: "Commercial interviews without customer documents; account link required.", fields: [
    text("title", "Interview title", true), select("segment", "Customer segment", segments), date("interviewDate", "Interview date"),
    notes("participants", "Interview participants"), notes("problems", "Problems identified"), notes("existingSolutions", "Existing solutions"),
    notes("currentProcess", "Current process"), select("painSeverity", "Pain severity", ["Low", "Medium", "High"]),
    notes("impact", "Financial or operational impact"), notes("purchasingAuthority", "Purchasing authority"),
    notes("budgetSignals", "Budget signals"), notes("buyingTimeline", "Buying timeline"), notes("requirements", "Product requirements"),
    notes("objections", "Objections"), notes("validatedUseCases", "Validated use cases"),
    select("validation", "Validation classification", ["Customer-validated", "Internal assumption"], true), notes("validationEvidence", "Validation evidence"), ...next,
  ] },
  { id: "pilots", label: "Pilots and proposals", description: OCI_PILOT_DISCLAIMER, fields: [
    text("name", "Pilot/proposal name", true), select("offerType", "Offer type", ["Pilot", "Proposal"], true),
    notes("scope", "Pilot scope"), notes("contractCategories", "Contract categories"), number("documentCount", "Document/contract count", 1e8),
    notes("documentAssumptions", "Document size and complexity assumptions"), notes("deliverables", "Agreed deliverables"),
    number("durationDays", "Duration (days)", 3650), number("price", "Commercial price"), number("deliveryCost", "Estimated delivery cost"), ...money,
    notes("successCriteria", "Success criteria"), notes("dataProtection", "Data protection requirements"),
    select("pilotStatus", "Status", ["Draft", "Proposed", "Active", "Completed", "Converted", "Cancelled"], true),
    number("conversionProbability", "Manual conversion potential (%)", 100), notes("conversionAssumptions", "Conversion assumptions"),
    notes("results", "Results"), notes("feedback", "Feedback"), notes("capabilityVerification", "Human capability verification", true), ...next,
  ] },
  { id: "revenue", label: "Revenue intelligence", description: "Actuals and forecasts are separate and grouped by currency; account link required.", fields: [
    text("name", "Revenue entry name", true), select("basis", "Financial basis", ["Actual", "Forecast"], true),
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
];
