import OpenAI from "openai";
import axios from "axios";

// ======================================================
// OPENAI
// ======================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// MAIN EXPORT
// ======================================================

export async function extractObligations(clauses) {
  try {

    // ==================================================
    // MISTRAL FIRST
    // ==================================================

    try {

      const mistral =
        await extractWithMistral(
          clauses
        );

      if (
        mistral &&
        mistral.length > 0
      ) {

        return mistral;
      }

    } catch (err) {

      console.error(
        "MISTRAL OBLIGATION ERROR:",
        err.message
      );
    }

    // ==================================================
    // OPENAI SECOND
    // ==================================================

    try {

      const openAI =
        await extractWithOpenAI(
          clauses
        );

      if (
        openAI &&
        openAI.length > 0
      ) {

        return openAI;
      }

    } catch (err) {

      console.error(
        "OPENAI OBLIGATION ERROR:",
        err.message
      );
    }

    // ==================================================
    // LOCAL FALLBACK
    // ==================================================

    return localObligationEngine(
      clauses
    );

  } catch (err) {

    console.error(
      "OBLIGATION ENGINE FAILURE:",
      err
    );

    return [];
  }
}

// ======================================================
// MISTRAL
// ======================================================

async function extractWithMistral(
  clauses
) {

  const response =
    await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model:
          "mistral-small-latest",

        messages: [
          {
            role: "system",

            content: `
Extract all contractual obligations.

Return ONLY JSON.

{
  "obligations": []
}
`
          },

          {
            role: "user",

            content:
              JSON.stringify(clauses)
          }
        ],

        temperature: 0.1,

        response_format: {
          type: "json_object"
        }
      },

      {
        headers: {
          Authorization:
            `Bearer ${process.env.MISTRAL_API_KEY}`,

          "Content-Type":
            "application/json"
        }
      }
    );

  const raw =
    response.data
      .choices?.[0]
      ?.message?.content;

  const parsed =
    JSON.parse(raw);

  return parsed.obligations || [];
}

// ======================================================
// OPENAI
// ======================================================

async function extractWithOpenAI(
  clauses
) {

  const completion =
    await openai.chat.completions.create({

      model:
        "gpt-4.1-mini",

      temperature: 0.1,

      messages: [
        {
          role: "system",

          content: `
Extract all contractual obligations.

Return ONLY JSON.

{
  "obligations": []
}
`
        },

        {
          role: "user",

          content:
            JSON.stringify(clauses)
        }
      ],

      response_format: {
        type: "json_object"
      }
    });

  const raw =
    completion.choices?.[0]
      ?.message?.content;

  const parsed =
    JSON.parse(raw);

  return parsed.obligations || [];
}

// ======================================================
// LOCAL ENGINE
// ======================================================

function localObligationEngine(
  clauses
) {

  const obligations = [];

  clauses.forEach((clause) => {

    const type =
      clause.clause_type;

    const text =
      (
        clause.clause_text || ""
      ).toLowerCase();

    const title =
      clause.clause_title ||
      "Unknown";

    // ==============================================
    // PAYMENT
    // ==============================================

    if (
      type === "payment"
    ) {

      obligations.push({

        clause_title:
          title,

        obligation_type:
          "payment",

        responsible_party:
          detectParty(text),

        obligation_text:
          "Payment obligation detected",

        priority:
          "HIGH",

        deadline:
          detectDeadline(text),

        risk_level:
          "HIGH"
      });
    }

    // ==============================================
    // INSURANCE
    // ==============================================

    if (
      type === "insurance"
    ) {

      obligations.push({

        clause_title:
          title,

        obligation_type:
          "insurance",

        responsible_party:
          detectParty(text),

        obligation_text:
          "Insurance obligation detected",

        priority:
          "MEDIUM",

        deadline:
          detectDeadline(text),

        risk_level:
          "MEDIUM"
      });
    }

    // ==============================================
    // COMPLIANCE
    // ==============================================

    if (
      type === "compliance"
    ) {

      obligations.push({

        clause_title:
          title,

        obligation_type:
          "compliance",

        responsible_party:
          detectParty(text),

        obligation_text:
          "Compliance obligation detected",

        priority:
          "HIGH",

        deadline:
          detectDeadline(text),

        risk_level:
          "HIGH"
      });
    }

  });

  return obligations;
}

// ======================================================
// PARTY DETECTION
// ======================================================

function detectParty(text) {

  if (
    text.includes("lessor")
  ) {

    return "Lessor";
  }

  if (
    text.includes("lessee")
  ) {

    return "Lessee";
  }

  if (
    text.includes("club")
  ) {

    return "Club";
  }

  return "Unknown";
}

// ======================================================
// DEADLINE DETECTION
// ======================================================

function detectDeadline(text) {

  const match =
    text.match(
      /within\s+\d+\s+days/i
    );

  if (
    match
  ) {

    return match[0];
  }

  return null;
    }
