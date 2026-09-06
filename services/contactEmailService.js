const CONTACT_RECIPIENT = "info@operionos.com";

function singleLine(value) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function buildContactEmail(request, fromEmail = process.env.CONTACT_FROM_EMAIL) {
  const company = singleLine(request.company);
  const lines = [
    `Name: ${request.name}`,
    `Business email: ${request.email}`,
    `Company: ${request.company}`,
    `Role: ${request.role}`,
    `Company type: ${request.companyType}`,
    `Interest: ${request.interest || "Not specified"}`,
    "",
    "Message:",
    request.message || "Not provided",
  ];

  return {
    from: fromEmail,
    to: [CONTACT_RECIPIENT],
    reply_to: request.email,
    subject: `Private Operion demo request - ${company}`,
    text: lines.join("\n"),
  };
}

export async function sendContactEmail(request, options = {}) {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
  const fetchImpl = options.fetchImpl ?? fetch;
  const email = buildContactEmail(request, options.fromEmail);

  if (!apiKey || !email.from) {
    const error = new Error("Contact email delivery is not configured");
    error.code = "CONTACT_EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(email),
  });

  if (!response.ok) {
    const error = new Error("Contact email delivery failed");
    error.code = "CONTACT_EMAIL_DELIVERY_FAILED";
    throw error;
  }
}