import { z } from "zod";

import { SourceFindingSchema } from "./common.js";

export const ClassificationSchema = SourceFindingSchema.extend({
  contract_type: z.string().trim().min(1),
  subtype: z.string().trim().min(1).optional(),
  rationale: z.string().trim().min(1).optional(),
}).strict();

export const ClassificationSchemaVersion = "phase3a.classification.v1";
