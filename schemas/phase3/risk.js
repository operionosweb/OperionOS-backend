import { z } from "zod";

import { RISK_CATEGORIES } from "../../domain/contractIntelligence/enums.js";
import { RISK_TYPES } from "../../services/phase3/intelligence/riskTaxonomy.js";
import { SeveritySchema, SourceFindingSchema } from "./common.js";

export const RiskSchema = SourceFindingSchema.extend({
  clause_id: z.string().uuid().optional(),
  risk_category: z.enum(RISK_CATEGORIES),
  risk_type: z.enum(RISK_TYPES).optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  rationale: z.string().trim().min(1).optional(),
  severity: SeveritySchema,
  probability: z.number().min(0).max(1).nullable().default(null),
  impact: z.string().trim().min(1).optional(),
  exposure: z.string().trim().min(1).optional(),
  consequence: z.string().trim().min(1).nullable().optional(),
  financial_exposure: z.object({
    type: z.enum(["quantified", "unquantified", "cap_with_carve_outs"]),
    amount: z.number().nonnegative().nullable().optional(),
    currency: z.string().length(3).nullable().optional(),
  }).passthrough().nullable().optional(),
  source_references: z.array(z.object({
    source_type: z.enum(["clause", "obligation", "deadline"]),
    source_id: z.string().uuid(),
  })).min(1).optional(),
  explanation: z.string().trim().min(1),
}).strict();

export const RiskSchemaVersion = "phase3e.risk.v1";
