import { OCI_MODULES, OCI_STAGES } from "../shared/ociContracts.js";
import { createOciRepository } from "../repositories/ociRepository.js";
import {
  compileOciGeographicQuery, isLegacyGeographicField, normalizeOciGeographicFilters,
  preserveOciGeographicData, validateOciGeography,
} from "../shared/ociGeography.js";
import { OCI_ACCOUNT_FIT_CRITERIA } from "../shared/ociAccountFit.js";

export class OciError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const invalid = (message) => { throw new OciError(400, "OCI_INVALID_INPUT", message); };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateOciId(value) { if (typeof value !== "string" || !uuidPattern.test(value)) invalid("Invalid record identity"); return value; }
export function validateOciKind(kind) { if (!OCI_MODULES.some(m => m.id === kind)) invalid("Unknown OCI module"); return kind; }
const object = value => value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const cleanString = (value, max) => typeof value === "string" && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const ACTION_TRANSITIONS = Object.freeze({
  Accepted: ["In progress", "Completed", "Dismissed", "Snoozed"],
  "In progress": ["Completed", "Dismissed", "Snoozed"],
  Snoozed: ["Accepted", "In progress", "Completed", "Dismissed"],
});
const ACTION_HISTORY_LIMIT = 4000;
const recommendationIdentity = /^(accounts|contacts|market|discovery|opportunities|pilots|activities):[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:founder-next-step-v1$/i;
export function validateOciStages(stages) {
  if (!Array.isArray(stages) || stages.length < 2 || stages.length > 30 ||
      stages.some(s => !cleanString(s, 60) || !s.trim() || s !== s.trim()) ||
      new Set(stages.map(s => s.toLowerCase())).size !== stages.length ||
      !stages.includes("Won") || !stages.includes("Lost")) invalid("Stages require 2–30 unique names including Won and Lost");
  return [...stages];
}
export function validateOciData(kind, data, stages = OCI_STAGES, currentData = {}) {
  validateOciKind(kind);
  if (!object(data)) invalid("Data must be an object");
  const submitted = data;
  const fields = OCI_MODULES.find(m => m.id === kind).fields;
  data = preserveOciGeographicData(kind, data, currentData, fields);
  const known = new Set(fields.map(f => f.key));
  if (Object.keys(data).some(key => !known.has(key))) invalid("Unknown data field; credentials and customer documents are not accepted");
  const output = {};
  for (const f of fields) {
    if (f.internalOnly) {
      if (Object.hasOwn(submitted, f.key)) invalid(`${f.label} is server-managed`);
      if (Object.hasOwn(currentData, f.key)) output[f.key] = currentData[f.key];
      continue;
    }
    if (f.readOnly && Object.hasOwn(currentData, f.key)) {
      if (Object.hasOwn(submitted, f.key) && submitted[f.key] !== currentData[f.key])
        invalid(`${f.label} cannot be changed after creation`);
      output[f.key] = currentData[f.key];
      continue;
    }
    const value = data[f.key];
    if (value === undefined || value === null || value === "") { if (f.required) invalid(`${f.label} is required`); continue; }
    if (f.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < f.min || value > f.max) invalid(`${f.label} is outside its allowed range`);
    } else {
      if (!cleanString(value, f.max || 4000) || !value.trim()) invalid(`${f.label} must be valid text`);
      if (f.type === "select" && !(kind === "opportunities" && f.key === "stage" ? stages : f.options).includes(value)) invalid(`Invalid ${f.label}`);
      if (f.type === "date" && !validDate(value)) invalid(`Invalid ${f.label}`);
      if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) invalid("Invalid professional email");
      if (f.type === "url") {
        let parsed; try { parsed = new URL(value); } catch { invalid(`Invalid ${f.label}`); }
        if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) invalid("Only credential-free HTTP(S) references are accepted");
      }
    }
    output[f.key] = typeof value === "string" && Object.hasOwn(submitted, f.key)
      ? isLegacyGeographicField(kind, f.key) ? value : value.trim()
      : value;
  }
  validateOciGeography(kind, output);
  if (output.currency) {
    output.currency = output.currency.toUpperCase();
    if (!/^[A-Z]{3}$/.test(output.currency)) invalid("Currency must be an ISO 4217 code");
    try { if (!Intl.supportedValuesOf("currency").includes(output.currency)) invalid("Unsupported currency"); } catch (error) { if (error instanceof OciError) throw error; invalid("Unsupported currency"); }
  }
  if (["accounts", "market"].includes(kind) && output.classification === "Verified fact" && (!output.source || !output.researchDate)) invalid("Verified facts require source evidence and research date");
  if (["accounts", "market"].includes(kind) && output.researchStatus === "Researched" && (!output.source || !output.researchDate)) invalid("Completed research requires source evidence and research date");
  if (kind === "accounts" && output.stakeholderStatus) {
    if (!output.stakeholderDepartment || !output.stakeholderEvidence) invalid("Stakeholder assessments require a department and evidence or hypothesis rationale");
    if (["Verified contact recorded", "Publicly identified person"].includes(output.stakeholderStatus) &&
        (!output.source || !output.researchDate))
      invalid("Identified stakeholders require source evidence and a research date");
  }
  if (kind === "contacts" && output.identityStatus === "Verified contact" &&
      !["Contacted", "Engaged"].includes(output.relationshipStatus))
    invalid("A verified contact requires a recorded human interaction");
  if (kind === "contacts" && output.identityStatus === "Publicly identified person" && !output.jobTitle)
    invalid("Publicly identified people require a sourced professional role");
  if (kind === "accounts" && output.companySize !== undefined && (!output.companySizeEvidence || output.classification !== "Verified fact")) invalid("Company size requires verified evidence");
  if (kind === "accounts") {
    const fitAssessments = OCI_ACCOUNT_FIT_CRITERIA.filter(({ key }) => output[key] && output[key] !== "Unknown");
    if (fitAssessments.length && !output.fitEvidence) invalid("Account-fit assessments require criterion-specific evidence and rationale");
    if (fitAssessments.some(({ key }) => output[key].startsWith("Verified — ")) &&
        (!output.source || !output.researchDate))
      invalid("Verified account-fit assessments require a source and last-researched date");
  }
  if (kind === "opportunities" && output.probability !== undefined && !output.probabilityAssumptions) invalid("Probability requires manual assumptions");
  if (kind === "opportunities") {
    const changedStage = output.stage !== currentData.stage;
    if (changedStage && currentData.stage && !output.stageChangeEvidence)
      invalid("Opportunity stage changes require recorded evidence or rationale");
    if (!currentData.stage && !["Identified", "Target identified"].includes(output.stage) && !output.stageChangeEvidence)
      invalid("Opportunities created beyond the identified stage require evidence or rationale");
    if (output.stage === "Lost" && !output.lossReason) invalid("Lost opportunities require a loss reason");
    if (output.stage === "On hold" && !output.holdReason) invalid("On-hold opportunities require a reason");
    if (output.stage === "Won" && (!output.stageChangeEvidence || !output.sourceEvidence))
      invalid("Won opportunities require stage evidence and a commercial source");
  }
  if (kind === "pilots" && output.conversionProbability !== undefined && !output.conversionAssumptions) invalid("Conversion probability requires manual assumptions");
  if (kind === "pilots" && (output.pilotStatus === "Proposed" || output.proposalStatus === "Awaiting customer" ||
      output.proposalStatus === "Accepted")) {
    if (!output.customerProblem || !output.contractUseCase || !output.scope || !output.deliverables ||
        output.durationDays === undefined || output.price === undefined || !output.successCriteria || !output.priceEvidence)
      invalid("A proposed offer requires a sourced customer problem, use case, measurable scope, deliverables, timeline, price basis and success criteria");
  }
  if (kind === "pilots" && output.documentCount !== undefined && !output.documentAssumptions)
    invalid("A supplied contract portfolio size requires its source or estimate basis");
  if (kind === "pilots" && output.approvalStatus === "Approved" && !output.approvalEvidence)
    invalid("Approved proposals require an internal approval reference or rationale");
  if (kind === "pilots" && ["Awaiting customer", "Accepted"].includes(output.proposalStatus) && output.approvalStatus !== "Approved")
    invalid("A customer-facing proposal requires recorded internal approval");
  if (kind === "pilots" && output.proposalStatus === "Accepted" && !output.customerDecisionEvidence)
    invalid("Accepted proposals require customer decision evidence");
  if (kind === "pilots" && ["Active", "Converted"].includes(output.pilotStatus) &&
      (output.proposalStatus !== "Accepted" || !output.customerDecisionEvidence))
    invalid("Active or converted pilots require an evidenced customer-approved proposal");
  if (kind === "discovery" && output.validation === "Customer-validated" && !output.validationEvidence) invalid("Customer validation requires evidence");
  if (kind === "revenue" && (output.basis === "Forecast" ? !output.assumptions : !output.source)) invalid("Forecasts require assumptions; actuals require financial evidence");
  if (kind === "revenue") {
    if (output.revenueClass === "Unclassified legacy" &&
        (Object.keys(currentData).length === 0 || currentData.revenueClass))
      invalid("Unclassified legacy is reserved for editing previously unclassified entries");
    if (output.revenueClass === "Recognised actual" && output.basis !== "Actual")
      invalid("Recognised actual revenue must use the Actual basis");
    if (output.revenueClass && !["Recognised actual", "Unclassified legacy"].includes(output.revenueClass) && output.basis !== "Forecast")
      invalid("Contracted, committed and speculative future revenue must use the Forecast basis until recognised");
    if (["Contracted future", "Committed pilot"].includes(output.revenueClass) && (!output.source || !output.assumptions))
      invalid("Contracted and committed-pilot forecasts require commitment evidence and period assumptions");
  }
  if (kind === "revenue" && ["Estimated", "Recorded"].includes(output.costBasis)) {
    if (["deliveryCost", "infrastructureCost", "aiProcessingCost", "storageCost"].some(key => output[key] === undefined))
      invalid("Assessed margins require all delivery, infrastructure, AI processing and storage costs, including explicit zeros");
    if (output.costBasis === "Estimated" && !output.assumptions) invalid("Estimated costs require assumptions even for actual revenue");
    if (output.costBasis === "Recorded" && (!output.source || output.basis === "Forecast")) invalid("Recorded costs require evidence and actual financial basis");
  }
  if (kind === "activities") validateActivityLifecycle(output, currentData);
  return output;
}
function validateActivityLifecycle(data, currentData = {}) {
  const previous = currentData.actionStatus || null;
  const next = data.actionStatus || null;
  if (previous && !next) invalid("Commercial action status cannot be removed");
  if (!previous && data.recommendationId && next !== "Accepted")
    invalid("Recommendations must be explicitly accepted before they become actions");
  if (next && previous !== next) {
    const allowed = previous ? ACTION_TRANSITIONS[previous] || [] : ["Accepted", "In progress", "Completed", "Dismissed", "Snoozed"];
    if (!allowed.includes(next)) invalid("This commercial action transition is not permitted");
  }
  if (data.responseStatus === "Awaiting external response" &&
      (data.activityStatus !== "Completed" || !["Meeting", "Call", "Email"].includes(data.type) ||
       !data.outcome || !data.followUpDate))
    invalid("Waiting for a response requires a completed recorded interaction, outcome and follow-up date");
  if (!next) return;
  if (["Accepted", "In progress", "Snoozed"].includes(next) && data.activityStatus !== "Planned")
    invalid("Open commercial actions must remain planned activities");
  if (next === "Completed" &&
      (data.activityStatus !== "Completed" || !data.completedDate || !data.outcome))
    invalid("Completing an action requires a completed activity, date and outcome notes");
  if (next === "Dismissed" &&
      (data.activityStatus !== "Cancelled" || !data.dismissalReason))
    invalid("Dismissing an action requires a cancelled activity and dismissal reason");
  if (next === "Snoozed" &&
      (!data.reviewDate || data.reviewDate <= new Date().toISOString().slice(0, 10)))
    invalid("Snoozing an action requires a future review date");
  if (data.completedDate && data.completedDate > new Date().toISOString().slice(0, 10))
    invalid("Action completion date cannot be in the future");
  if (data.recommendationId) {
    if (!recommendationIdentity.test(data.recommendationId) || !data.actionCategory ||
        !data.recommendationReason || !data.recommendationEvidence || !data.expectedObjective ||
        !data.relatedRecordKind || !data.relatedRecordId)
      invalid("Accepted recommendations require their original rationale, evidence and source relationship");
    const [kind, id] = data.recommendationId.split(":");
    if (kind !== data.relatedRecordKind || id !== data.relatedRecordId)
      invalid("Recommendation identity must match its source record");
  } else if (next === "Accepted") {
    invalid("Only a sourced recommendation can be accepted as a commercial action");
  }
  if (previous && currentData.recommendationId !== data.recommendationId)
    invalid("Recommendation identity cannot be changed");
}
function recordActionHistory(data, currentData, actorId) {
  if (!data.actionStatus || data.actionStatus === currentData.actionStatus) return data;
  let history = [];
  if (currentData.actionHistory) {
    try { history = JSON.parse(currentData.actionHistory); }
    catch { invalid("Existing action history is malformed and cannot be safely changed"); }
    if (!Array.isArray(history)) invalid("Existing action history is malformed and cannot be safely changed");
  }
  history.push({ status: data.actionStatus, at: new Date().toISOString(), actorId });
  const serialized = JSON.stringify(history);
  if (serialized.length > ACTION_HISTORY_LIMIT)
    invalid("Action history is full; create a linked follow-up activity before changing its state again");
  return { ...data, actionHistory: serialized };
}
function deriveFounderRecommendation(source, today = new Date().toISOString().slice(0, 10)) {
  const data = source.data || {};
  const sourceKind = source.kind;
  const decisionDate = data.expectedDecisionDate || data.expectedCloseDate;
  const staleDate = new Date(`${today}T00:00:00.000Z`);
  staleDate.setUTCDate(staleDate.getUTCDate() - 30);
  const staleBefore = staleDate.toISOString().slice(0, 10);
  const staleInteraction = Boolean(data.lastInteraction && data.lastInteraction <= staleBefore);
  const dueDate = data.followUpDate || data.dueDate || decisionDate || null;
  let actionCategory = "";
  let recommendationReason = "";
  let recommendedAction = "";
  const eligible =
    sourceKind === "accounts" && data.accountStatus === "Target" && data.priority === "High" &&
      ["Not researched", "Needs verification"].includes(data.researchStatus || "Not researched") ||
    sourceKind === "contacts" && data.relationshipStatus === "Identified" && Boolean(data.source?.trim()) ||
    sourceKind === "discovery" && ["Interview completed", "Needs follow-up"].includes(data.discoveryStatus) &&
      !data.nextAction?.trim() ||
    sourceKind === "opportunities" && !["Won", "Lost", "On hold"].includes(data.stage) &&
      (data.stage === "Qualified" && data.followUpDate && data.followUpDate < today ||
        Boolean(decisionDate && decisionDate >= today && decisionDate <= new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10)) ||
        !data.nextAction?.trim() || staleInteraction) ||
    sourceKind === "pilots" && data.offerType === "Proposal" && data.proposalStatus === "Awaiting customer" &&
      (!data.nextAction?.trim() || !data.followUpDate || data.followUpDate < today) ||
    sourceKind === "activities" && data.activityStatus === "Planned" && data.dueDate &&
      data.dueDate <= new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  if (!eligible) return null;
  if (sourceKind === "accounts") {
    actionCategory = "Research";
    recommendationReason = "Explicit high priority; account research is not complete.";
    recommendedAction = "Complete source-backed research and confirm the next relevant stakeholder.";
  } else if (sourceKind === "contacts") {
    actionCategory = "Contact";
    recommendationReason = "A sourced stakeholder is identified, but no contact attempt is recorded.";
    recommendedAction = "Review the source and record a human-approved contact attempt or next step.";
  } else if (sourceKind === "discovery") {
    actionCategory = "Discovery";
    recommendationReason = "Discovery is completed or needs follow-up, with no next action recorded.";
    recommendedAction = "Record interview findings and set a dated next action.";
  } else if (sourceKind === "opportunities") {
    actionCategory = "Opportunity";
    recommendationReason = data.followUpDate && data.followUpDate < today
      ? "The recorded opportunity follow-up date has passed."
      : !data.nextAction?.trim() ? "The open opportunity has no documented next action."
        : staleInteraction ? "The last recorded interaction is at least 30 days old."
          : "The recorded customer decision date is within 14 days.";
    recommendedAction = !data.nextAction?.trim()
      ? "Agree and record the next human-approved commercial step and due date."
      : staleInteraction
        ? "Review the recorded relationship history and agree a human-approved next step."
        : "Confirm the decision timeline with the account team and update the next action.";
  } else if (sourceKind === "pilots") {
    actionCategory = "Pilot / proposal";
    recommendationReason = "Proposal is awaiting the customer decision and has no current follow-up.";
    recommendedAction = "Record the customer decision or schedule an approved follow-up.";
  } else {
    actionCategory = "Follow-up";
    recommendationReason = "A planned commercial activity is due or overdue.";
    recommendedAction = data.nextAction?.trim() || "Complete or reschedule the planned activity.";
  }
  const evidence = [data.source, data.sourceEvidence, data.validationEvidence, data.fitEvidence]
    .find(value => typeof value === "string" && value.trim())?.trim() ||
    `Recorded workflow status: ${data.stage || data.discoveryStatus || data.pilotStatus || data.relationshipStatus || data.activityStatus || "active"}; last updated ${source.updated_at ? new Date(source.updated_at).toISOString().slice(0, 10) : today}`;
  const urgent = Boolean(data.followUpDate && data.followUpDate < today ||
    data.dueDate && data.dueDate < today ||
    decisionDate && decisionDate <= new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10) ||
    staleInteraction);
  return {
    actionCategory, recommendationReason, recommendedAction, evidence, dueDate,
    urgency: urgent ? "Urgent" : "Routine",
    recommendationId: `${sourceKind}:${source.id}:founder-next-step-v1`,
  };
}
function boundedInteger(value, fallback, max) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) invalid("Invalid pagination");
  return Number(value);
}
export function calculateOciRevenue(groups) {
  return groups.map(group => {
    const n = key => Number(group[key] || 0);
    const optional = key => group[key] === null || group[key] === undefined ? null : Number(group[key]);
    const amount = group.amountComplete === false ? null : n("amount");
    const costComplete = group.costComplete === true;
    const marginBasis = costComplete ? (group.hasEstimatedCosts === true ? "Estimated" : "Recorded") : "Unknown";
    const cost = costComplete ? n("deliveryCost") + n("infrastructureCost") + n("aiProcessingCost") + n("storageCost") : null;
    return { currency: group.currency, basis: group.basis, revenueClass: group.revenueClass || "Unclassified legacy",
      periodDate: group.periodDate ?? null, countryCode: group.countryCode ?? null, segment: group.segment ?? null,
      dataOrigin: group.dataOrigin || "Unclassified", amount, pilotRevenue: n("pilotRevenue"), subscriptionRevenue: n("subscriptionRevenue"),
      mrr: optional("mrr"), arr: optional("arr"), annualContractValue: optional("annualContractValue"), acquisitionCost: optional("acquisitionCost"), lifetimeValue: optional("lifetimeValue"),
      costComplete, marginBasis, cost, grossMargin: costComplete && amount !== null ? amount - cost : null,
      grossMarginPercent: costComplete && amount ? (amount - cost) / amount * 100 : null };
  });
}
export function createOciService(repository = createOciRepository()) {
  async function links(kind, input, current) {
    const accountId = Object.hasOwn(input, "accountId") ? input.accountId : current?.account_id ?? null;
    const opportunityId = Object.hasOwn(input, "opportunityId") ? input.opportunityId : current?.opportunity_id ?? null;
    if (accountId !== null) validateOciId(accountId);
    if (opportunityId !== null) validateOciId(opportunityId);
    if (["contacts", "opportunities", "activities", "discovery", "pilots", "revenue"].includes(kind) && !accountId) invalid("An account link is required");
    if (kind === "accounts" && (accountId || opportunityId) || kind === "opportunities" && opportunityId) invalid("Invalid parent link");
    if (accountId) {
      const account = await repository.getRecord("accounts", accountId);
      if (!account || account.status !== "active") invalid("Account must reference an active OCI account");
    }
    if (opportunityId) {
      const opportunity = await repository.getRecord("opportunities", opportunityId);
      if (!opportunity || opportunity.status !== "active" || opportunity.account_id !== accountId) invalid("Opportunity must be active and belong to the same account");
    }
    return { accountId, opportunityId };
  }
  async function validateActionRelationship(kind, data, accountId, opportunityId) {
    if (kind !== "activities" || !data.relatedRecordKind && !data.relatedRecordId) return;
    if (!data.relatedRecordKind || !data.relatedRecordId) invalid("A related source record requires both kind and identity");
    validateOciId(data.relatedRecordId);
    const source = await repository.getRecord(data.relatedRecordKind, data.relatedRecordId);
    if (!source || source.status !== "active") invalid("Related source record must be active");
    if (data.relatedRecordKind === "accounts") {
      if (source.id !== accountId) invalid("Related account must match the activity account");
    } else if (source.account_id !== accountId) {
      invalid("Related source record must belong to the activity account");
    }
    if (data.relatedRecordKind === "opportunities" && source.id !== opportunityId)
      invalid("Related opportunity must match the activity opportunity");
    if (data.recommendationId) {
      const expectedOpportunity = data.relatedRecordKind === "opportunities" ? source.id : source.opportunity_id || null;
      if (opportunityId !== expectedOpportunity)
        invalid("Recommendation opportunity relationship must match its source record");
    }
  }
  function body(input, allowed) { if (!object(input) || Object.keys(input).some(k => !allowed.includes(k))) invalid("Unknown request field"); }
  function version(value) { if (!Number.isSafeInteger(value) || value < 1 || value > 2147483646) invalid("A valid current version is required"); }
  async function currentRecord(kind, id, expectedVersion) {
    validateOciKind(kind); validateOciId(id); version(expectedVersion);
    const record = await repository.getRecord(kind, id);
    if (!record) throw new OciError(404, "OCI_NOT_FOUND", "Record not found");
    if (record.version !== expectedVersion || record.status !== "active") throw new OciError(409, "OCI_VERSION_CONFLICT", "Record changed or archived; reload before retrying");
    return record;
  }
  const service = {
    async schema() {
      const stages = await repository.getStages();
      return { modules: OCI_MODULES.map(module => ({ ...module, fields: module.fields.map(field =>
        module.id === "opportunities" && field.key === "stage" ? { ...field, options: stages } : { ...field }) })), stages };
    },
    async listRecords(kind, query = {}) {
      validateOciKind(kind); body(query, ["search", "status", "sort", "page", "pageSize", "geoScope",
        "geoCountries", "geoRegions", "geoCities", "geoAirports", "geoSegments", "geoCompanyTypes"]);
      const page = boundedInteger(query.page, 1, 10000), pageSize = boundedInteger(query.pageSize, 25, 100);
      const search = query.search ?? "";
      if (typeof search !== "string" || search.length > 200 || /[\u0000-\u001f]/.test(search)) invalid("Invalid search");
      const status = query.status ?? "active", sort = query.sort ?? "updated_desc";
      if (!["active", "archived", "all"].includes(status) || !["updated_desc", "updated_at_desc", "updated_at_asc", "created_desc", "name_asc", "name_desc"].includes(sort)) invalid("Invalid filter or sort");
      return repository.listRecords(kind, { search, status, sort, page, pageSize,
        geography: normalizeOciGeographicFilters(query) });
    },
    async createRecord(kind, input, actorId) {
      validateOciKind(kind); validateOciId(actorId); body(input, ["data", "accountId", "opportunityId"]);
      let data = validateOciData(kind, input.data, await repository.getStages());
      if (kind === "activities" && data.recommendationId)
        invalid("Accept recommendations through the recommendation action endpoint");
      const parents = await links(kind, input);
      await validateActionRelationship(kind, data, parents.accountId, parents.opportunityId);
      data = recordActionHistory(data, {}, actorId);
      const record = await repository.createRecord(kind, { data, ...parents }, actorId);
      if (!record && kind === "activities" && data.recommendationId)
        throw new OciError(409, "OCI_DUPLICATE_ACTION", "This recommendation already has a recorded commercial action");
      return record;
    },
    async acceptRecommendation(kind, id, input, actorId) {
      validateOciId(actorId); validateOciId(id);
      if (!["accounts", "contacts", "discovery", "opportunities", "pilots", "activities"].includes(kind))
        invalid("This record type does not produce founder recommendations");
      body(input, ["dueDate"]);
      if (input.dueDate !== undefined && input.dueDate !== "" &&
          (typeof input.dueDate !== "string" || !validDate(input.dueDate)))
        invalid("Invalid action due date");
      const source = await repository.getRecord(kind, id);
      if (!source || source.status !== "active")
        throw new OciError(404, "OCI_RECOMMENDATION_NOT_FOUND", "Recommendation source is unavailable");
      const recommendation = deriveFounderRecommendation(source);
      if (!recommendation)
        throw new OciError(409, "OCI_RECOMMENDATION_STALE", "This recommendation is no longer supported by the current record");
      const accountId = kind === "accounts" ? source.id : source.account_id;
      const opportunityId = kind === "opportunities" ? source.id : source.opportunity_id || null;
      const data = {
        title: recommendation.recommendedAction.slice(0, 240),
        type: kind === "accounts" ? "Research" : "Follow-up",
        activityStatus: "Planned", actionStatus: "Accepted",
        actionCategory: recommendation.actionCategory, recommendationId: recommendation.recommendationId,
        recommendationReason: recommendation.recommendationReason,
        recommendationEvidence: recommendation.evidence, expectedObjective: recommendation.recommendedAction,
        relatedRecordKind: kind, relatedRecordId: source.id, actionScope: "Account geography",
        nextAction: recommendation.recommendedAction,
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      };
      const validated = validateOciData("activities", data, await repository.getStages());
      const parents = await links("activities", { accountId, opportunityId });
      await validateActionRelationship("activities", validated, parents.accountId, parents.opportunityId);
      const withHistory = recordActionHistory(validated, {}, actorId);
      const record = await repository.createRecord("activities", { data: withHistory, ...parents }, actorId);
      if (!record)
        throw new OciError(409, "OCI_DUPLICATE_ACTION", "This recommendation already has a recorded commercial action");
      return record;
    },
    async updateRecord(kind, id, input, actorId) {
      validateOciId(actorId); body(input, ["data", "accountId", "opportunityId", "version"]);
      const current = await currentRecord(kind, id, input.version);
      let data = validateOciData(kind, input.data, await repository.getStages(), current.data);
      const parents = await links(kind, input, current);
      await validateActionRelationship(kind, data, parents.accountId, parents.opportunityId);
      data = recordActionHistory(data, current.data, actorId);
      if (kind === "opportunities" && parents.accountId !== current.account_id &&
        await repository.hasMismatchedOpportunityReferences(id, parents.accountId))
        throw new OciError(409, "OCI_REFERENCED_RECORD", "Unlink dependent records before changing the opportunity account");
      const record = await repository.updateRecord(kind, id, { data, ...parents, version: input.version }, actorId);
      if (!record) throw new OciError(409, "OCI_VERSION_CONFLICT", "Record changed; reload before retrying");
      return record;
    },
    async archiveRecord(kind, id, input, actorId) {
      validateOciId(actorId); body(input, ["version"]);
      const current = await currentRecord(kind, id, input.version);
      if (kind === "activities" && current.data?.actionStatus)
        invalid("Commercial action history is retained; complete or dismiss the action instead of archiving it");
      if (await repository.hasActiveReferences(id)) throw new OciError(409, "OCI_REFERENCED_RECORD", "Archive or unlink dependent records first");
      const record = await repository.archiveRecord(kind, id, input.version, actorId);
      if (!record) throw new OciError(409, "OCI_VERSION_CONFLICT", "Record changed; reload before retrying");
      return record;
    },
    async eraseContact(id, input, actorId) {
      validateOciId(actorId); validateOciId(id); body(input, ["version"]); version(input.version);
      const current = await repository.getRecord("contacts", id);
      if (!current) throw new OciError(404, "OCI_NOT_FOUND", "Contact not found");
      if (current.version !== input.version || current.data?.privacyErased === true)
        throw new OciError(409, "OCI_VERSION_CONFLICT", "Contact changed or already erased; reload before retrying");
      const record = await repository.eraseContact(id, input.version, actorId);
      if (!record) throw new OciError(409, "OCI_VERSION_CONFLICT", "Contact changed or already erased; reload before retrying");
      return record;
    },
    async dashboard(query = {}) {
      body(query, ["geoScope", "geoCountries", "geoRegions", "geoCities", "geoAirports", "geoSegments", "geoCompanyTypes"]);
      const geography = normalizeOciGeographicFilters(query);
      const result = await repository.dashboard(geography);
      return { ...result, metrics: result.metrics, nextActions: result.nextActions,
        revenueSummary: { financials: calculateOciRevenue(result.financials),
          pipeline: result.pipeline.map(g => ({ currency: g.currency, countryCode: g.countryCode ?? null,
            segment: g.segment ?? null, probabilityComplete: g.probabilityComplete === true,
            opportunityCount: Number(g.opportunityCount || 0), dataOrigin: g.dataOrigin || "Unclassified",
            value: Number(g.value), weightedValue: g.weightedValue === null || g.weightedValue === undefined
              ? null : Number(g.weightedValue) })) } };
    },
    async geographyOptions(query = {}) {
      body(query, ["geoScope"]);
      const geography = normalizeOciGeographicFilters(query);
      return repository.geographyOptions(geography.scope);
    },
    async audit(query = {}) { body(query, ["limit"]); return repository.listAudit(boundedInteger(query.limit, 50, 100)); },
    async getStages() { return repository.getStages(); },
    async setStages(input, actorId) {
      validateOciId(actorId); body(input, ["stages"]);
      const stages = validateOciStages(input.stages);
      const used = await repository.usedStages();
      if (used.some(stage => !stages.includes(stage))) invalid("Cannot remove a stage used by an active or archived opportunity");
      await repository.setStages(stages, actorId);
      return stages;
    },
  };
  return service;
}
