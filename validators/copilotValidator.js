import { z } from "zod";

export const CopilotSchema = z.object({
  decision_chain: z.array(
    z.object({
      clause: z.string().optional(),
      obligation: z.string().optional(),
      risk_trigger: z.string().optional(),
      operational_consequence: z.string().optional(),
      owner: z.string().optional(),
      recommendation: z.string().optional(),
    })
  ),

  executive_summary: z.string().optional(),

  risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),

  top_operational_risks: z
    .array(
      z.object({
        issue: z.string().optional(),
        impact: z.string().optional(),
        severity: z.string().optional(),
      })
    )
    .optional(),
});

export function validateCopilotOutput(data) {
  try {
    return CopilotSchema.parse(data);
  } catch (err) {
    console.error("❌ VALIDATION FAILED:", err.message);
    return null;
  }
}