import { z } from "zod";

export const UUIDSchema = z.string().uuid();
export const ConfidenceSchema = z.number().min(0).max(1);
export const ReviewStatusSchema = z.enum([
  "pending",
  "verified",
  "requires_review",
  "rejected",
]);
export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const PrioritySchema = SeveritySchema;
export const EvidenceIdsSchema = z.array(UUIDSchema).min(1);

export const SourceFindingSchema = z.object({
  confidence: ConfidenceSchema,
  review_status: ReviewStatusSchema,
  evidence_ids: EvidenceIdsSchema,
});

export const ISODateSchema = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "Expected a valid date or ISO datetime"
);
