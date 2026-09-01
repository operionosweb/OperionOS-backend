import { z } from "zod";

import { DEADLINE_TYPES } from "../../domain/contractIntelligence/enums.js";
import { ISODateSchema, SourceFindingSchema } from "./common.js";

export const DeadlineSchema = SourceFindingSchema.extend({
  obligation_id: z.string().uuid().optional(),
  source_clause_id: z.string().uuid().optional(),
  source_evidence_id: z.string().uuid().optional(),
  deadline_type: z.enum(DEADLINE_TYPES),
  original_expression: z.string().trim().min(1).optional(),
  normalized_date: ISODateSchema.nullable().optional(),
  anchor_event: z.string().trim().min(1).optional(),
  offset_value: z.number().int().optional(),
  offset_unit: z.enum(["hours", "days", "weeks", "months", "years"]).optional(),
  timing_expression: z.string().trim().min(1).optional(),
  structured_timing: z.record(z.string(), z.unknown()).optional(),
  trigger_type: z.string().trim().min(1).nullable().optional(),
  trigger_expression: z.string().trim().min(1).nullable().optional(),
  condition: z.string().trim().min(1).nullable().optional(),
  amount: z.number().int().positive().nullable().optional(),
  unit: z.enum(["hours", "days", "business_days", "weeks", "months", "years", "flight_hours", "flight_cycles"]).nullable().optional(),
  calendar_type: z.enum(["calendar", "business"]).nullable().optional(),
  absolute_date: ISODateSchema.nullable().optional(),
  anchor_reference: z.string().trim().min(1).nullable().optional(),
  direction: z.enum(["before", "after", "upon"]).nullable().optional(),
  recurrence: z.record(z.string(), z.unknown()).nullable().optional(),
  computability: z.enum(["absolute", "calculable", "relative_event", "awaiting_anchor", "recurrence_rule", "ambiguous", "non_computable"]).optional(),
  ambiguity: z.string().trim().min(1).nullable().optional(),
  status: z.enum(["identified", "computable", "awaiting_trigger", "awaiting_date", "ambiguous", "calculated"]).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).superRefine((value, context) => {
  if (value.deadline_type === "relative_deadline" && (!value.anchor_event || value.offset_value === undefined || !value.offset_unit)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Relative deadlines require an anchor and offset", path: ["deadline_type"] });
  }
  if (value.deadline_type === "fixed_date" && !value.normalized_date) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed dates require normalized_date", path: ["normalized_date"] });
  }
  if (["absolute", "relative", "recurring", "event_based", "conditional", "ambiguous", "non_computable"].includes(value.deadline_type)
    && (!value.obligation_id || !value.source_clause_id || !value.source_evidence_id || !value.timing_expression || !value.structured_timing || !value.computability || !value.status)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Step 6 deadlines require scoped source and structured timing", path: ["deadline_type"] });
  }
  if (["relative", "conditional"].includes(value.deadline_type) && value.amount !== null && value.amount !== undefined) {
    if (!value.unit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Relative deadline amounts require a unit",
        path: ["unit"],
      });
    }
  }

  if (value.deadline_type === "absolute" && !value.absolute_date) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Absolute deadlines require absolute_date",
      path: ["absolute_date"],
    });
  }
});

export const DeadlineSchemaVersion = "phase3d.deadline.v1";
