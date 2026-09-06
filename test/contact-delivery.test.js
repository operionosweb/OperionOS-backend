import assert from "node:assert/strict";
import test from "node:test";

import { contactRequestSchema } from "../routes/contactRoutes.js";
import { buildContactEmail, sendContactEmail } from "../services/contactEmailService.js";

const request = {
  name: "Test User",
  email: "test@example.com",
  company: "Operion",
  role: "Legal",
  companyType: "Airline",
  interest: "Contract Intelligence",
  message: "Prepared test request",
};

test("contact requests reject malformed and unexpected fields", () => {
  assert.equal(contactRequestSchema.safeParse({}).success, false);
  assert.equal(contactRequestSchema.safeParse({ ...request, unexpected: true }).success, false);
  assert.equal(contactRequestSchema.safeParse(request).success, true);
});

test("contact email is addressed to Info with a validated reply-to", () => {
  const email = buildContactEmail(request, "Operion <noreply@operionos.com>");
  assert.deepEqual(email.to, ["info@operionos.com"]);
  assert.equal(email.reply_to, request.email);
  assert.equal(email.from, "Operion <noreply@operionos.com>");
});

test("contact delivery sends a server-side Resend request", async () => {
  let sentRequest;
  const fetchImpl = async (url, options) => {
    sentRequest = { url, options };
    return { ok: true };
  };

  await sendContactEmail(request, {
    apiKey: "test-key",
    fromEmail: "Operion <noreply@operionos.com>",
    fetchImpl,
  });

  const body = JSON.parse(sentRequest.options.body);
  assert.equal(sentRequest.url, "https://api.resend.com/emails");
  assert.deepEqual(body.to, ["info@operionos.com"]);
  assert.equal(body.reply_to, request.email);
  assert.equal(sentRequest.options.headers.Authorization, "Bearer test-key");
});