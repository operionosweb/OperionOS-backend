import { z } from "zod";

import { RISK_CATEGORIES } from "../../domain/contractIntelligence/enums.js";
import { SeveritySchema, SourceFindingSchema } from "./common.js";

export const RiskSchema = SourceFindingSchema.extend({
  clause_id: z.string().uuid().optional(),
  risk_category: z.enum(RISK_CATEGORIES),
  severity: SeveritySchema,
  probability: z.number().min(0).max(1).nullable().default(null),
  impact: z.string().trim().min(1).optional(),
  exposure: z.string().trim().min(1).optional(),
  score: z.number().min(0).max(100).optional(),
  risk_drivers: z.array(z.string().trim().min(1)).default([]),
  explanation: z.string().trim().min(1),
}).strict();

export const RiskSchemaVersion = "phase3a.risk.v1";
