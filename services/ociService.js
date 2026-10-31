import { OCI_MODULES, OCI_STAGES } from "../shared/ociContracts.js";
import { createOciRepository } from "../repositories/ociRepository.js";

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
export function validateOciStages(stages) {
  if (!Array.isArray(stages) || stages.length < 2 || stages.length > 30 ||
      stages.some(s => !cleanString(s, 60) || !s.trim() || s !== s.trim()) ||
      new Set(stages.map(s => s.toLowerCase())).size !== stages.length ||
      !stages.includes("Won") || !stages.includes("Lost")) invalid("Stages require 2–30 unique names including Won and Lost");
  return [...stages];
}
export function validateOciData(kind, data, stages = OCI_STAGES) {
  validateOciKind(kind);
  if (!object(data)) invalid("Data must be an object");
  const fields = OCI_MODULES.find(m => m.id === kind).fields;
  const known = new Set(fields.map(f => f.key));
  if (Object.keys(data).some(key => !known.has(key))) invalid("Unknown data field; credentials and customer documents are not accepted");
  const output = {};
  for (const f of fields) {
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
    output[f.key] = typeof value === "string" ? value.trim() : value;
  }
  if (output.currency) {
    output.currency = output.currency.toUpperCase();
    if (!/^[A-Z]{3}$/.test(output.currency)) invalid("Currency must be an ISO 4217 code");
    try { if (!Intl.supportedValuesOf("currency").includes(output.currency)) invalid("Unsupported currency"); } catch (error) { if (error instanceof OciError) throw error; invalid("Unsupported currency"); }
  }
  if (["accounts", "market"].includes(kind) && output.classification === "Verified fact" && (!output.source || !output.researchDate)) invalid("Verified facts require source evidence and research date");
  if (kind === "accounts" && output.companySize !== undefined && (!output.companySizeEvidence || output.classification !== "Verified fact")) invalid("Company size requires verified evidence");
  if (kind === "opportunities" && output.probability !== undefined && !output.probabilityAssumptions) invalid("Probability requires manual assumptions");
  if (kind === "pilots" && output.conversionProbability !== undefined && !output.conversionAssumptions) invalid("Conversion probability requires manual assumptions");
  if (kind === "discovery" && output.validation === "Customer-validated" && !output.validationEvidence) invalid("Customer validation requires evidence");
  if (kind === "revenue" && (output.basis === "Forecast" ? !output.assumptions : !output.source)) invalid("Forecasts require assumptions; actuals require financial evidence");
  if (kind === "revenue" && ["Estimated", "Recorded"].includes(output.costBasis)) {
    if (["deliveryCost", "infrastructureCost", "aiProcessingCost", "storageCost"].some(key => output[key] === undefined))
      invalid("Assessed margins require all delivery, infrastructure, AI processing and storage costs, including explicit zeros");
    if (output.costBasis === "Estimated" && !output.assumptions) invalid("Estimated costs require assumptions even for actual revenue");
    if (output.costBasis === "Recorded" && (!output.source || output.basis === "Forecast")) invalid("Recorded costs require evidence and actual financial basis");
  }
  return output;
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
    return { currency: group.currency, basis: group.basis, periodDate: group.periodDate ?? null, amount, pilotRevenue: n("pilotRevenue"), subscriptionRevenue: n("subscriptionRevenue"),
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
      validateOciKind(kind); body(query, ["search", "status", "sort", "page", "pageSize"]);
      const page = boundedInteger(query.page, 1, 10000), pageSize = boundedInteger(query.pageSize, 25, 100);
      const search = query.search ?? "";
      if (typeof search !== "string" || search.length > 200 || /[\u0000-\u001f]/.test(search)) invalid("Invalid search");
      const status = query.status ?? "active", sort = query.sort ?? "updated_desc";
      if (!["active", "archived", "all"].includes(status) || !["updated_desc", "updated_at_desc", "updated_at_asc", "created_desc", "name_asc", "name_desc"].includes(sort)) invalid("Invalid filter or sort");
      return repository.listRecords(kind, { search, status, sort, page, pageSize });
    },
    async createRecord(kind, input, actorId) {
      validateOciKind(kind); validateOciId(actorId); body(input, ["data", "accountId", "opportunityId"]);
      const data = validateOciData(kind, input.data, await repository.getStages());
      return repository.createRecord(kind, { data, ...await links(kind, input) }, actorId);
    },
    async updateRecord(kind, id, input, actorId) {
      validateOciId(actorId); body(input, ["data", "accountId", "opportunityId", "version"]);
      const current = await currentRecord(kind, id, input.version);
      const data = validateOciData(kind, input.data, await repository.getStages());
      const parents = await links(kind, input, current);
      if (kind === "opportunities" && parents.accountId !== current.account_id &&
        await repository.hasMismatchedOpportunityReferences(id, parents.accountId))
        throw new OciError(409, "OCI_REFERENCED_RECORD", "Unlink dependent records before changing the opportunity account");
      const record = await repository.updateRecord(kind, id, { data, ...parents, version: input.version }, actorId);
      if (!record) throw new OciError(409, "OCI_VERSION_CONFLICT", "Record changed; reload before retrying");
      return record;
    },
    async archiveRecord(kind, id, input, actorId) {
      validateOciId(actorId); body(input, ["version"]); await currentRecord(kind, id, input.version);
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
    async dashboard() {
      const result = await repository.dashboard();
      return { metrics: result.metrics, nextActions: result.nextActions, revenueSummary: { financials: calculateOciRevenue(result.financials), pipeline: result.pipeline.map(g => ({ currency: g.currency, value: Number(g.value), weightedValue: Number(g.weightedValue) })) } };
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
