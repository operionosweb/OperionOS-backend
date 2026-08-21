import { z } from "zod";

const ProviderMetadataSchema = z.object({
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  schema_version: z.string().trim().min(1),
  prompt_version: z.string().trim().min(1).optional(),
  pipeline_version: z.string().trim().min(1).optional(),
  retry_count: z.number().int().min(0),
  latency_ms: z.number().int().min(0).optional(),
  input_tokens: z.number().int().min(0).optional(),
  output_tokens: z.number().int().min(0).optional(),
  cost_estimate: z.number().min(0).optional(),
}).strict();

export const ProviderResultSchema = z.object({
  status: z.enum(["completed", "failed"]),
  metadata: ProviderMetadataSchema,
  output: z.unknown().optional(),
  error_code: z.string().trim().min(1).optional(),
  error_message: z.string().trim().min(1).optional(),
}).strict().superRefine((value, context) => {
  if (value.status === "completed" && value.output === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Completed provider results require output",
      path: ["output"],
    });
  }

  if (value.status === "failed" && !value.error_code) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Failed provider results require error_code",
      path: ["error_code"],
    });
  }
});

export const ProviderResultSchemaVersion = "phase3a.provider-result.v1";
