import { z } from "zod";

import { DEADLINE_TYPES } from "../../domain/contractIntelligence/enums.js";
import { ISODateSchema, SourceFindingSchema } from "./common.js";

const RelativeDeadlineSchema = z.object({
  deadline_type: z.literal("relative_deadline"),
  original_expression: z.string().trim().min(1),
  anchor_event: z.string().trim().min(1),
  offset_value: z.number().int(),
  offset_unit: z.enum(["hours", "days", "weeks", "months", "years"]),
  normalized_date: z.null().optional(),
});

const FixedDeadlineSchema = z.object({
  deadline_type: z.literal("fixed_date"),
  original_expression: z.string().trim().min(1),
  normalized_date: ISODateSchema,
  anchor_event: z.string().trim().min(1).optional(),
  offset_value: z.number().int().optional(),
  offset_unit: z.string().trim().min(1).optional(),
});

export const DeadlineSchema = SourceFindingSchema.extend({
  obligation_id: z.string().uuid().optional(),
  deadline_type: z.enum(DEADLINE_TYPES),
  original_expression: z.string().trim().min(1),
  normalized_date: ISODateSchema.nullable().optional(),
  range_start: ISODateSchema.nullable().optional(),
  range_end: ISODateSchema.nullable().optional(),
  anchor_event: z.string().trim().min(1).optional(),
  offset_value: z.number().int().optional(),
  offset_unit: z.enum(["hours", "days", "weeks", "months", "years"]).optional(),
  timezone: z.string().trim().min(1).optional(),
  ambiguity: z.string().trim().min(1).optional(),
}).superRefine((value, context) => {
  if (value.deadline_type === "relative_deadline") {
    if (!value.anchor_event || value.offset_value === undefined || !value.offset_unit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Relative deadlines require an anchor and offset",
        path: ["deadline_type"],
      });
    }
    if (value.normalized_date !== undefined && value.normalized_date !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Relative deadlines cannot invent an absolute date",
        path: ["normalized_date"],
      });
    }
  }

  if (value.deadline_type === "fixed_date" && !value.normalized_date) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fixed dates require normalized_date",
      path: ["normalized_date"],
    });
  }

  if (value.range_start && value.range_end && Date.parse(value.range_start) > Date.parse(value.range_end)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "range_start cannot be after range_end",
      path: ["range_start"],
    });
  }
});

export const RelativeDeadlineExampleSchema = SourceFindingSchema.merge(RelativeDeadlineSchema);
export const DeadlineSchemaVersion = "phase3a.deadline.v1";
