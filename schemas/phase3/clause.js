import { z } from "zod";

import { CLAUSE_CATEGORIES } from "../../domain/contractIntelligence/enums.js";
import { SourceFindingSchema } from "./common.js";

export const ClauseSchema = SourceFindingSchema.extend({
  clause_number: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  category: z.enum(CLAUSE_CATEGORIES),
  subtype: z.string().trim().min(1).optional(),
  source_text: z.string().trim().min(1),
  parent_clause_id: z.string().uuid().optional(),
}).strict();

export const ClauseSchemaVersion = "phase3a.clause.v1";
