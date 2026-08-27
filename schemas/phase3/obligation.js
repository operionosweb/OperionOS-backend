import { z } from "zod";

import { SourceFindingSchema } from "./common.js";

const ObligationTypes = [
  "payment",
  "maintenance",
  "insurance",
  "compliance",
  "termination",
  "notification",
  "delivery",
  "redelivery",
  "service_level",
  "other",
];

export const ObligationSchema = SourceFindingSchema.extend({
  clause_id: z.string().uuid(),
  description: z.string().trim().min(1),
  obligation_type: z.enum(ObligationTypes),
  obligor_party_id: z.string().uuid().optional(),
  counterparty_party_id: z.string().uuid().optional(),
  trigger_expression: z.string().trim().min(1).optional(),
  conditionality: z.string().trim().min(1).optional(),
  frequency: z.string().trim().min(1).optional(),
  actor: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  object: z.string().trim().min(1).optional(),
  beneficiary: z.string().trim().min(1).optional(),
  condition: z.string().trim().min(1).optional(),
  timing_expression: z.string().trim().min(1).optional(),
  consequence: z.string().trim().min(1).optional(),
  modality: z.enum(["mandatory", "prohibited", "discretionary", "conditional"]).default("mandatory"),
  priority: z.enum(["low", "medium", "high", "critical"]),
  deadline_ids: z.array(z.string().uuid()).default([]),
}).strict();

export const ObligationSchemaVersion = "phase3a.obligation.v1";
