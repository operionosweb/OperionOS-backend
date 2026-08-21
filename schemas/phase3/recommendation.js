import { z } from "zod";

import { RECOMMENDATION_TYPES } from "../../domain/contractIntelligence/enums.js";
import { SourceFindingSchema } from "./common.js";

export const RecommendationSchema = SourceFindingSchema.extend({
  risk_id: z.string().uuid().optional(),
  clause_id: z.string().uuid().optional(),
  recommendation_type: z.enum(RECOMMENDATION_TYPES),
  action: z.string().trim().min(1),
  business_rationale: z.string().trim().min(1),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  owner_role: z.string().trim().min(1).optional(),
}).strict();

export const RecommendationSchemaVersion = "phase3a.recommendation.v1";
