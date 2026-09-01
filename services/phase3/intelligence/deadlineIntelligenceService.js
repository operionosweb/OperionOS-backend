import crypto from "node:crypto";
import { z } from "zod";

import { createDeadlineRepository } from "../../../repositories/phase3/deadlineRepository.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { aiGateway } from "../../ai/aiGateway.js";

const PARSER_VERSION = "phase3d-deadline-parser-v1";
const TAXONOMY_VERSION = "aviation-temporal-v1";
const PROMPT_VERSION = "deadline-semantic-fallback-v1";
const SCHEMA_VERSION = "phase3d.deadline.v1";

const FallbackOutputSchema = z.object({
  deadline_type: z.enum(["relative", "recurring", "event_based", "conditional", "ambiguous", "non_computable"]),
  timing_expression: z.string().trim().min(1),
  trigger_type: z.string().trim().min(1).nullable().optional(),
  trigger_expression: z.string().trim().min(1).nullable().optional(),
  condition: z.string().trim().min(1).nullable().optional(),
  amount: z.number().int().positive().nullable().optional(),
  unit: z.enum(["hours", "days", "business_days", "weeks", "months", "years", "flight_hours", "flight_cycles"]).nullable().optional(),
  calendar_type: z.enum(["calendar", "business"]).nullable().optional(),
  direction: z.enum(["before", "after", "upon"]).nullable().optional(),
  anchor_reference: z.string().trim().min(1).nullable().optional(),
  recurrence: z.object({ frequency: z.string().trim().min(1) }).nullable().optional(),
  computability: z.enum(["relative_event", "awaiting_anchor", "recurrence_rule", "ambiguous", "non_computable"]),
  ambiguity: z.string().trim().min(1).nullable().optional(),
  confidence: z.number().min(0).max(1),
}).strict();

const NUMBER_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  ninety: 90,
});

const MONTHS = Object.freeze({
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
});

const AMBIGUOUS_PATTERNS = [
  /\bpromptly\b/i,
  /\bimmediately\b/i,
  /\bwithout undue delay\b/i,
  /\bas soon as (?:reasonably practicable|possible)\b/i,
  /\bcommercially reasonable time\b/i,
  /\breasonable period\b/i,
];

const RECURRENCES = [
  ["semi_annually", /\b(?:semi-annually|semiannually|twice yearly)\b/i],
  ["quarterly", /\bquarterly\b|\beach quarter\b/i],
  ["annually", /\bannually\b|\bannual(?:ly)?\b|\beach year\b/i],
  ["monthly", /\bmonthly\b|\beach month\b/i],
  ["weekly", /\bweekly\b|\beach week\b/i],
  ["daily", /\bdaily\b|\beach day\b/i],
  ["per_flight_hour", /\bper flight hour\b/i],
  ["per_flight_cycle", /\bper flight cycle\b/i],
  ["per_maintenance_event", /\bper maintenance event\b/i],
];

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const parts = value.toLowerCase().split(/[ -]/).filter(Boolean);
  if (!parts.length || parts.some((part) => NUMBER_WORDS[part] === undefined)) return null;
  return parts.reduce((total, part) => total + NUMBER_WORDS[part], 0);
}

function isoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export function parseAbsoluteDate(expression, { numericDateOrder = null } = {}) {
  const text = normalizeWhitespace(expression);
  let match = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
  if (match) {
    const date = isoDate(Number(match[3]), MONTHS[match[2].toLowerCase()], Number(match[1]));
    return { date, expression: match[0], ambiguous: !date, reason: date ? null : "Invalid calendar date" };
  }

  match = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (match) {
    const date = isoDate(Number(match[3]), MONTHS[match[1].toLowerCase()], Number(match[2]));
    return { date, expression: match[0], ambiguous: !date, reason: date ? null : "Invalid calendar date" };
  }

  match = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!numericDateOrder && first <= 12 && second <= 12) {
    return { date: null, expression: match[0], ambiguous: true, reason: "Numeric date order is ambiguous" };
  }
  const order = numericDateOrder || (first > 12 ? "DMY" : "MDY");
  const day = order === "DMY" ? first : second;
  const month = order === "DMY" ? second - 1 : first - 1;
  return { date: isoDate(Number(match[3]), month, day), expression: match[0], ambiguous: false };
}

function extractCondition(text) {
  const match = text.match(/^\s*(if|unless|provided that)\s+(.+?)(?=,\s*(?:the\s+)?[A-Z]|,\s*(?:notify|pay|provide|return|deliver)|$)/i);
  return match ? normalizeWhitespace(match[0].replace(/,$/, "")) : null;
}

function normalizeAnchor(value) {
  return normalizeWhitespace(value)
    .replace(/^(?:the\s+)?/i, "")
    .replace(/[.,;:]$/, "")
    .replace(/\bbecoming aware of\b/i, "awareness of")
    .replace(/\breceipt of\b/i, "receipt of")
    .toLowerCase();
}

function findRelative(text) {
  const number = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|ninety)(?:[- ](one|two|three|four|five|six|seven|eight|nine))?";
  const unit = "(business\\s+days?|calendar\\s+days?|hours?|days?|weeks?|months?|years?|flight\\s+hours?|flight\\s+cycles?|cycles?)";
  const direction = "(after|following|from|before|prior to)";
  const regex = new RegExp(`\\b(?:within\\s+|no later than\\s+|not later than\\s+)?${number}\\s+${unit}(?:\\s+${direction}\\s+([^,.;]+))?`, "i");
  const match = text.match(regex);
  if (!match) return null;

  const amountText = match[2] ? `${match[1]} ${match[2]}` : match[1];
  const rawUnit = match[3].toLowerCase();
  const rawDirection = match[4]?.toLowerCase() || null;
  const normalizedUnit = rawUnit.startsWith("business") ? "business_days"
    : rawUnit.startsWith("calendar") ? "days"
      : rawUnit.startsWith("flight hour") ? "flight_hours"
        : rawUnit.startsWith("flight cycle") || rawUnit.startsWith("cycle") ? "flight_cycles"
          : rawUnit.replace(/s$/, "") + "s";

  return {
    expression: match[0],
    amount: parseNumber(amountText),
    unit: normalizedUnit,
    calendar_type: normalizedUnit === "business_days" ? "business" : normalizedUnit === "days" ? "calendar" : null,
    direction: rawDirection === "before" || rawDirection === "prior to" ? "before" : "after",
    anchor: match[5] ? normalizeAnchor(match[5]) : null,
  };
}

function findEvent(text) {
  const match = text.match(/\b(upon|at|before|after|following)\s+(delivery|redelivery|acceptance|termination|execution|signing|lease expiry|expiry of the term|maintenance event|an? [ac]-check|grounding|material damage|regulatory action)\b/i);
  if (!match) return null;
  return {
    expression: match[0],
    direction: match[1].toLowerCase() === "before" ? "before" : match[1].toLowerCase() === "after" || match[1].toLowerCase() === "following" ? "after" : "upon",
    anchor: normalizeAnchor(match[2]),
  };
}

export class BusinessCalendar {
  constructor({ weekendDays = [0, 6], holidays = [], jurisdiction = null } = {}) {
    this.weekendDays = new Set(weekendDays);
    this.holidays = new Set(holidays);
    this.jurisdiction = jurisdiction;
  }

  addBusinessDays(anchorDate, amount) {
    const date = new Date(`${anchorDate}T00:00:00.000Z`);
    const step = amount < 0 ? -1 : 1;
    let remaining = Math.abs(amount);
    while (remaining > 0) {
      date.setUTCDate(date.getUTCDate() + step);
      const key = date.toISOString().slice(0, 10);
      if (!this.weekendDays.has(date.getUTCDay()) && !this.holidays.has(key)) remaining -= 1;
    }
    return date.toISOString().slice(0, 10);
  }
}

export function calculateDeadline({ anchorDate, amount, unit, direction = "after", businessCalendar = null }) {
  if (!anchorDate) return { date: null, reason: "Requires anchor date" };
  const signedAmount = direction === "before" ? -amount : amount;
  if (unit === "business_days") {
    if (!businessCalendar) return { date: null, reason: "Business-day calendar unavailable" };
    return { date: businessCalendar.addBusinessDays(anchorDate, signedAmount), method: "business_calendar" };
  }
  if (["flight_hours", "flight_cycles"].includes(unit)) return { date: null, reason: `Requires ${unit.replace("_", " ")} event data` };

  const date = new Date(`${anchorDate}T00:00:00.000Z`);
  if (unit === "hours") date.setUTCHours(date.getUTCHours() + signedAmount);
  else if (unit === "days") date.setUTCDate(date.getUTCDate() + signedAmount);
  else if (unit === "weeks") date.setUTCDate(date.getUTCDate() + signedAmount * 7);
  else if (unit === "months") date.setUTCMonth(date.getUTCMonth() + signedAmount);
  else if (unit === "years") date.setUTCFullYear(date.getUTCFullYear() + signedAmount);
  else return { date: null, reason: "Unsupported calculation unit" };
  return { date: date.toISOString().slice(0, 10), method: "utc_calendar_arithmetic" };
}

export function parseTemporalExpression(expression, options = {}) {
  const originalExpression = normalizeWhitespace(expression);
  if (!originalExpression) return null;
  const condition = options.condition ? normalizeWhitespace(options.condition) : extractCondition(originalExpression);
  const temporalText = condition && originalExpression.startsWith(condition)
    ? normalizeWhitespace(originalExpression.slice(condition.length).replace(/^,\s*/, ""))
    : originalExpression;
  const ambiguous = AMBIGUOUS_PATTERNS.find((pattern) => pattern.test(originalExpression));
  if (ambiguous) {
    return {
      deadline_type: "ambiguous",
      timing_expression: originalExpression,
      condition,
      computability: "ambiguous",
      ambiguity: ambiguous.exec(originalExpression)?.[0] || originalExpression,
      absolute_date: null,
      status: "ambiguous",
      confidence: 0.99,
    };
  }

  const absolute = parseAbsoluteDate(temporalText, options);
  if (absolute) {
    return {
      deadline_type: absolute.ambiguous ? "ambiguous" : "absolute",
      timing_expression: absolute.expression,
      condition,
      computability: absolute.ambiguous ? "ambiguous" : "absolute",
      ambiguity: absolute.reason || null,
      absolute_date: absolute.date,
      status: absolute.ambiguous ? "ambiguous" : "calculated",
      confidence: absolute.ambiguous ? 0.6 : 0.99,
    };
  }

  const relative = findRelative(temporalText);
  if (relative) {
    const calculation = options.anchorDate
      ? calculateDeadline({ anchorDate: options.anchorDate, amount: relative.amount, unit: relative.unit, direction: relative.direction, businessCalendar: options.businessCalendar })
      : { date: null, reason: relative.anchor ? `Requires ${relative.anchor} date` : "Requires anchor event" };
    return {
      deadline_type: condition ? "conditional" : "relative",
      timing_expression: relative.expression,
      trigger_type: condition ? "condition" : relative.anchor ? "event" : null,
      trigger_expression: condition ? "condition becoming true" : relative.anchor,
      condition,
      amount: relative.amount,
      unit: relative.unit,
      calendar_type: relative.calendar_type,
      direction: relative.direction,
      anchor_reference: relative.anchor,
      recurrence: null,
      computability: calculation.date ? "calculable" : relative.anchor ? "relative_event" : "awaiting_anchor",
      absolute_date: calculation.date,
      status: calculation.date ? "calculated" : relative.anchor ? "awaiting_trigger" : "awaiting_date",
      ambiguity: null,
      confidence: 0.96,
      calculation: options.anchorDate ? { anchor_date: options.anchorDate, offset: relative.amount, unit: relative.unit, direction: relative.direction, method: calculation.method || null, reason: calculation.reason || null, result: calculation.date } : null,
    };
  }

  const monthlyBusinessDay = temporalText.match(/\b(?:on\s+)?the first Business Day of each month\b/i);
  if (monthlyBusinessDay) {
    return {
      deadline_type: "recurring",
      timing_expression: monthlyBusinessDay[0],
      condition,
      recurrence: { frequency: "monthly", ordinal: "first", calendar_type: "business" },
      calendar_type: "business",
      computability: "recurrence_rule",
      absolute_date: null,
      status: "identified",
      confidence: 0.99,
    };
  }

  const recurrence = RECURRENCES.find(([, pattern]) => pattern.test(temporalText));
  if (recurrence) {
    return {
      deadline_type: "recurring",
      timing_expression: recurrence[1].exec(temporalText)[0],
      condition,
      recurrence: { frequency: recurrence[0] },
      computability: "recurrence_rule",
      absolute_date: null,
      status: "identified",
      confidence: 0.98,
    };
  }

  const event = findEvent(temporalText);
  if (event) {
    return {
      deadline_type: condition ? "conditional" : "event_based",
      timing_expression: event.expression,
      trigger_type: "event",
      trigger_expression: event.anchor,
      condition,
      direction: event.direction,
      anchor_reference: event.anchor,
      computability: "relative_event",
      absolute_date: null,
      status: "awaiting_trigger",
      confidence: 0.97,
    };
  }

  return {
    deadline_type: "non_computable",
    timing_expression: originalExpression,
    condition,
    computability: "non_computable",
    absolute_date: null,
    status: "identified",
    ambiguity: "No deterministic temporal rule matched",
    confidence: 0.3,
  };
}

function extractDateDefinitions(clauses) {
  const definitions = new Map();
  for (const clause of clauses) {
    const text = normalizeWhitespace(clause.source_text);
    const match = text.match(/\b(Effective Date|Execution Date|Delivery Date|Termination Date)\b\s+(?:means|is|shall be)\s+([^.;]+)/i);
    if (!match) continue;
    const parsed = parseAbsoluteDate(match[2]);
    if (parsed?.date && !parsed.ambiguous) {
      definitions.set(match[1].toLowerCase(), {
        date: parsed.date,
        source_clause_id: clause.id,
        source_evidence_id: clause.source_evidence_id || null,
        expression: match[0],
      });
    }
  }
  return definitions;
}

function deadlineIdentity(obligation, interpretation) {
  return crypto.createHash("sha256").update(JSON.stringify({
    obligation_id: obligation.id,
    obligation_identity: obligation.obligation_identity,
    interpretation,
    parser_version: PARSER_VERSION,
    taxonomy_version: TAXONOMY_VERSION,
  })).digest("hex");
}

export function createGatewayDeadlineProvider({ gateway = aiGateway, confirmation = false, metrics = {} } = {}) {
  return {
    async analyzeStructured(payload) {
      metrics.requests = (metrics.requests || 0) + 1;
      const input = JSON.stringify(payload);
      const result = await gateway.request({
        organizationId: payload.organization_id,
        userId: payload.user_id || null,
        operation: "clause_interpretation",
        input,
        documentHash: crypto.createHash("sha256").update(input).digest("hex"),
        confirmation,
        structured: true,
        system: "Interpret only the supplied contractual timing. Return structured JSON, preserve uncertainty, and never invent an absolute date or source reference.",
      });
      metrics.estimatedIntelligence = (metrics.estimatedIntelligence || 0) + Number(result.estimatedIntelligence || result.job?.estimatedIntelligence || 0);
      metrics.actualIntelligence = (metrics.actualIntelligence || 0) + Number(result.job?.actualIntelligence || 0);
      if (result.source === "cache") metrics.cacheHits = (metrics.cacheHits || 0) + 1;
      if (result.source === "provider") metrics.cacheMisses = (metrics.cacheMisses || 0) + 1;
      if (!result.success || result.result === undefined) throw Object.assign(new Error("Deadline fallback was not completed"), { code: result.code || "AI_REQUEST_BLOCKED", status: 409 });
      const parsed = FallbackOutputSchema.safeParse(result.result);
      if (!parsed.success) throw Object.assign(new Error("Deadline fallback output failed schema validation"), { code: "PROVIDER_OUTPUT_INVALID", status: 422, issues: parsed.error.issues });
      return parsed.data;
    },
  };
}

export function createDeadlineIntelligenceService({ repository = createDeadlineRepository(), provider = null, metrics = {} } = {}) {
  return {
    async runStage({ useAIFallback = false, userId = null, ...scope }) {
      assertOrganizationScope(scope.organizationId);
      assertResourceId(scope.contractId, "contractId");
      assertResourceId(scope.documentId, "documentId");
      assertResourceId(scope.documentVersionId, "documentVersionId");
      assertResourceId(scope.analysisRunId, "analysisRunId");

      const [obligations, clauses] = await Promise.all([
        repository.listObligationsWithEvidence(scope),
        repository.listClausesForDefinitions(scope),
      ]);
      const definitions = extractDateDefinitions(clauses);
      const clausesById = new Map(clauses.map((clause) => [clause.id, clause]));
      const deadlines = [];
      let aiFallbackAnalyses = 0;

      for (const obligation of obligations) {
        const sourceExpression = obligation.description || obligation.timing_expression || obligation.frequency || obligation.trigger_expression;
        if (!sourceExpression || !obligation.evidence?.length) continue;
        let interpretation = parseTemporalExpression(sourceExpression, { condition: obligation.condition });
        const definition = interpretation?.anchor_reference ? definitions.get(interpretation.anchor_reference.toLowerCase()) : null;
        if (definition) interpretation = parseTemporalExpression(sourceExpression, { condition: obligation.condition, anchorDate: definition.date });
        const primaryEvidence = obligation.evidence.find((link) => link.is_primary) || obligation.evidence[0];
        if (interpretation.deadline_type === "non_computable" && useAIFallback) {
          if (!provider?.analyzeStructured) throw Object.assign(new Error("Deadline AI fallback is not configured"), { code: "PROVIDER_NOT_CONFIGURED", status: 422 });
          const clause = clausesById.get(obligation.clause_id);
          interpretation = await provider.analyzeStructured({
            organization_id: scope.organizationId,
            user_id: userId,
            obligation_id: obligation.id,
            obligation_identity: obligation.obligation_identity,
            obligation: {
              description: obligation.description,
              timing_expression: obligation.timing_expression || null,
              trigger_expression: obligation.trigger_expression || null,
              condition: obligation.condition || null,
              frequency: obligation.frequency || null,
            },
            relevant_clause: clause ? { id: clause.id, text: clause.source_text } : null,
            evidence_ids: obligation.evidence.map((link) => link.evidence_id),
            parser_version: PARSER_VERSION,
            prompt_version: PROMPT_VERSION,
            schema_version: SCHEMA_VERSION,
            taxonomy_version: TAXONOMY_VERSION,
          });
          interpretation = { ...interpretation, absolute_date: null, status: interpretation.deadline_type === "ambiguous" ? "ambiguous" : "identified" };
          aiFallbackAnalyses += 1;
        }
        deadlines.push({
          organization_id: scope.organizationId,
          contract_id: scope.contractId,
          document_id: scope.documentId,
          document_version_id: scope.documentVersionId,
          analysis_run_id: scope.analysisRunId,
          obligation_id: obligation.id,
          source_clause_id: obligation.clause_id,
          source_evidence_id: primaryEvidence.evidence_id,
          deadline_type: interpretation.deadline_type,
          original_expression: interpretation.timing_expression,
          timing_expression: interpretation.timing_expression,
          structured_timing: interpretation,
          trigger_type: interpretation.trigger_type || null,
          trigger_expression: interpretation.trigger_expression || null,
          condition: interpretation.condition || null,
          amount: interpretation.amount || null,
          unit: interpretation.unit || null,
          calendar_type: interpretation.calendar_type || null,
          absolute_date: interpretation.absolute_date || null,
          anchor_reference: interpretation.anchor_reference || null,
          direction: interpretation.direction || null,
          recurrence: interpretation.recurrence || null,
          computability: interpretation.computability,
          ambiguity: interpretation.ambiguity || null,
          confidence: interpretation.confidence,
          status: interpretation.status,
          review_status: "pending",
          metadata: {
            parser_version: PARSER_VERSION,
            taxonomy_version: TAXONOMY_VERSION,
            anchor_source: definition || null,
            calculation: interpretation.calculation || null,
          },
          deadline_identity: deadlineIdentity(obligation, interpretation),
          evidence: obligation.evidence,
        });
      }

      const persisted = await repository.persistDeadlines({ ...scope, deadlines });
      return {
        status: persisted.insertedDeadlines ? "deadlines_persisted" : obligations.length ? "already_processed" : "no_obligations",
        ...persisted,
        deterministicAnalyses: deadlines.length,
        aiFallbackAnalyses,
        aiIntelligenceConsumed: metrics.actualIntelligence || 0,
        estimatedIntelligence: metrics.estimatedIntelligence || 0,
        cacheHits: metrics.cacheHits || 0,
        cacheMisses: metrics.cacheMisses || 0,
        parserVersion: PARSER_VERSION,
      };
    },
  };
}

export const deadlineIntelligenceConstants = Object.freeze({
  parserVersion: PARSER_VERSION,
  taxonomyVersion: TAXONOMY_VERSION,
});