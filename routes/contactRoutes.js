import express from "express";
import { z } from "zod";
import { sendContactEmail } from "../services/contactEmailService.js";

const router = express.Router();
const attempts = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 5;

export const contactRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  company: z.string().trim().min(2).max(120),
  role: z.string().trim().min(2).max(80),
  companyType: z.enum(["Airline", "Aircraft Leasing", "MRO", "Ground Handling", "Aviation Services", "Consultancy", "Other"]),
  interest: z.enum(["Contract Intelligence", "Financial Exposure", "Risk & Recommendations", "Predictive Intelligence", "Other"]).optional(),
  message: z.string().trim().max(2000).optional(),
  website: z.string().max(200).optional(),
}).strict();

function exceedsRateLimit(identifier) {
  const now = Date.now();
  const recent = (attempts.get(identifier) || []).filter((time) => now - time < RATE_WINDOW_MS);
  recent.push(now);
  attempts.set(identifier, recent);
  return recent.length > RATE_LIMIT;
}

router.post("/", async (req, res) => {
  const identifier = req.ip || req.socket.remoteAddress || "unknown";
  if (exceedsRateLimit(identifier)) {
    return res.status(429).json({ success: false, error: "Too many requests" });
  }

  const parsed = contactRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid request" });
  }

  if (parsed.data.website) {
    return res.json({ success: true });
  }

  try {
    await sendContactEmail(parsed.data);
    return res.json({ success: true });
  } catch (error) {
    if (error.code === "CONTACT_EMAIL_NOT_CONFIGURED") {
      return res.status(503).json({ success: false, error: "Contact service unavailable" });
    }
    return res.status(502).json({ success: false, error: "Message delivery failed" });
  }
});

export default router;