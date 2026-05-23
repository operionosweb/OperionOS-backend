import OpenAI from "openai";
import axios from "axios";

// ======================================================
// OPENAI
// ======================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// MAIN EXTRACTOR
// ======================================================

export async function extractClauses(
  text
) {

  try {

    // ==================================================
    // VALIDATION
    // ==================================================

    if (
      !text ||
      text.length < 100
    ) {

      return [];
    }

    // ==================================================
    // MISTRAL FIRST
    // ==================================================

    try {

      const mistral =
        await extractWithMistral(
          text
        );

      if (
        Array.isArray(mistral) &&
        mistral.length > 0
      ) {

        return mistral;
      }

    } catch (err) {

      console.error(
        "MISTRAL CLAUSE ERROR:",
        err.message
      );
    }

    // ==================================================
    // OPENAI SECOND
    // ==================================================

    try {

      const openAI =
        await extractWithOpenAI(
          text
        );

      if (
        Array.isArray(openAI) &&
        openAI.length > 0
      ) {

        return openAI;
      }

    } catch (err) {

      console.error(
        "OPENAI CLAUSE ERROR:",
        err.message
      );
    }

    // ==================================================
    // LOCAL FALLBACK
    // ==================================================

    return localClauseExtractor(
      text
    );

  } catch (err) {

    console.error(
      "CLAUSE EXTRACTION FAILURE:",
      err
    );

    return localClauseExtractor(
      text
    );
  }
}

// ======================================================
// MISTRAL
// ======================================================

async function extractWithMistral(
  text
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
You are an enterprise legal AI system.

Extract all major contract clauses.

Return ONLY valid JSON array.

[
  {
    "clause_title": "",
    "clause_type": "",
    "risk_level": "",
    "summary": "",
    "clause_text": ""
  }
]
`
          },

          {
            role: "user",

            content:
              text.slice(0, 25000)
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

  if (
    Array.isArray(parsed)
  ) {

    return parsed;
  }

  if (
    parsed.clauses
  ) {

    return parsed.clauses;
  }

  return [];
}

// ======================================================
// OPENAI
// ======================================================

async function extractWithOpenAI(
  text
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
You are an enterprise legal AI system.

Extract all major contract clauses.

Return ONLY valid JSON array.

[
  {
    "clause_title": "",
    "clause_type": "",
    "risk_level": "",
    "summary": "",
    "clause_text": ""
  }
]
`
        },

        {
          role: "user",

          content:
            text.slice(0, 25000)
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

  if (
    Array.isArray(parsed)
  ) {

    return parsed;
  }

  if (
    parsed.clauses
  ) {

    return parsed.clauses;
  }

  return [];
}

// ======================================================
// LOCAL FALLBACK EXTRACTOR
// ======================================================

function localClauseExtractor(
  text
) {

  const clauses = [];

  const patterns = [

    {
      keyword: "termination",
      title: "Termination",
      type: "Termination"
    },

    {
      keyword: "liability",
      title: "Liability",
      type: "Liability"
    },

    {
      keyword: "insurance",
      title: "Insurance",
      type: "Insurance"
    },

    {
      keyword: "payment",
      title: "Payment",
      type: "Financial"
    },

    {
      keyword: "indemn",
      title: "Indemnification",
      type: "Indemnity"
    },

    {
      keyword: "confidential",
      title: "Confidentiality",
      type: "Confidentiality"
    },

    {
      keyword: "force majeure",
      title: "Force Majeure",
      type: "Force Majeure"
    },

    {
      keyword: "governing law",
      title: "Governing Law",
      type: "Legal"
    }
  ];

  patterns.forEach((pattern) => {

    if (
      text.toLowerCase()
        .includes(pattern.keyword)
    ) {

      clauses.push({

        clause_title:
          pattern.title,

        clause_type:
          pattern.type,

        risk_level:
          "Medium",

        summary:
          `${pattern.title} clause detected.`,

        clause_text:
          extractSnippet(
            text,
            pattern.keyword
          )
      });
    }
  });

  // ==================================================
  // LAST RESORT
  // ==================================================

  if (
    clauses.length === 0
  ) {

    clauses.push({

      clause_title:
        "General Contract Terms",

      clause_type:
        "General",

      risk_level:
        "Medium",

      summary:
        "General contractual language detected.",

      clause_text:
        text.slice(0, 1000)
    });
  }

  return clauses;
}

// ======================================================
// TEXT SNIPPET
// ======================================================

function extractSnippet(
  text,
  keyword
) {

  const lower =
    text.toLowerCase();

  const index =
    lower.indexOf(keyword);

  if (
    index === -1
  ) {

    return text.slice(0, 500);
  }

  const start =
    Math.max(0, index - 200);

  const end =
    Math.min(
      text.length,
      index + 500
    );

  return text.slice(
    start,
    end
  );
}
