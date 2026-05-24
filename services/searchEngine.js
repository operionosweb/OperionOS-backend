// services/searchEngine.js

/**
 * OPERION OS
 * Enterprise Contract Search Engine
 *
 * Responsibilities:
 * - Clause search
 * - Risk search
 * - Supplier search
 * - Missing protection detection
 * - Expiration intelligence
 * - Compliance retrieval
 * - Future semantic/vector search compatibility
 *
 * ESM VERSION
 */

const SEARCHABLE_COMPLIANCE_TERMS = [
  "gdpr",
  "faa",
  "easa",
  "imo",
  "soc2",
  "hipaa",
  "pci",
  "compliance",
];

const HIGH_RISK_TERMS = [
  "unlimited liability",
  "uncapped liability",
  "without limitation",
  "sole discretion",
  "non-cancellable",
  "irrevocable",
];

/**
 * -----------------------------------------
 * CLAUSE SEARCH
 * -----------------------------------------
 */
export function searchClauses(
  query = "",
  contracts = []
) {
  try {
    if (!query || !contracts.length) {
      return [];
    }

    const normalizedQuery =
      normalizeText(query);

    const results = [];

    for (const contract of contracts) {
      const clauses =
        contract?.clauses || [];

      for (const clause of clauses) {
        const clauseText =
          clause?.clause_text || "";

        const clauseType =
          clause?.clause_type || "";

        const searchableText = `
          ${clauseText}
          ${clauseType}
          ${contract?.name || ""}
          ${contract?.supplier_name || ""}
        `;

        const normalizedSearchable =
          normalizeText(
            searchableText
          );

        const relevanceScore =
          calculateRelevance(
            normalizedQuery,
            normalizedSearchable
          );

        if (relevanceScore > 0) {
          results.push({
            contract_id:
              contract?.id || null,

            contract_name:
              contract?.name ||
              "Unnamed Contract",

            supplier:
              contract?.supplier_name ||
              "Unknown Supplier",

            clause_id:
              clause?.id || null,

            clause_type:
              clauseType,

            normalized_clause_type:
              normalizeClauseType(
                clauseType
              ),

            relevance_score:
              relevanceScore,

            risk_score:
              contract?.risk_score || 0,

            semantic_tags:
              generateSemanticTags(
                clause
              ),

            matched_text:
              truncateText(
                clauseText,
                300
              ),
          });
        }
      }
    }

    return results.sort(
      (a, b) =>
        b.relevance_score -
        a.relevance_score
    );
  } catch (error) {
    console.error(
      "searchClauses() Error:",
      error.message
    );

    return [];
  }
}

/**
 * -----------------------------------------
 * SEARCH BY CLAUSE TYPE
 * -----------------------------------------
 */
export function searchByClauseType(
  type = "",
  contracts = []
) {
  try {
    const normalizedType =
      normalizeClauseType(type);

    const results = [];

    for (const contract of contracts) {
      const clauses =
        contract?.clauses || [];

      for (const clause of clauses) {
        const clauseType =
          normalizeClauseType(
            clause?.clause_type || ""
          );

        if (
          clauseType.includes(
            normalizedType
          )
        ) {
          results.push({
            contract_id:
              contract?.id || null,

            contract_name:
              contract?.name ||
              "Unnamed Contract",

            supplier:
              contract?.supplier_name ||
              "Unknown Supplier",

            clause_type:
              clause?.clause_type,

            normalized_clause_type:
              clauseType,

            risk_score:
              contract?.risk_score || 0,

            semantic_tags:
              generateSemanticTags(
                clause
              ),

            matched_text:
              truncateText(
                clause?.clause_text ||
                  "",
                300
              ),
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error(
      "searchByClauseType() Error:",
      error.message
    );

    return [];
  }
}

/**
 * -----------------------------------------
 * SEARCH BY RISK LEVEL
 * -----------------------------------------
 */
export function searchByRiskLevel(
  level = "High",
  contracts = []
) {
  try {
    const normalizedLevel =
      level.toLowerCase();

    const thresholds = {
      low: 0,
      medium: 25,
      high: 50,
      critical: 75,
    };

    const minimum =
      thresholds[
        normalizedLevel
      ] || 50;

    return contracts
      .filter(
        (contract) =>
          Number(
            contract?.risk_score || 0
          ) >= minimum
      )
      .map((contract) => ({
        contract_id:
          contract?.id || null,

        contract_name:
          contract?.name ||
          "Unnamed Contract",

        supplier:
          contract?.supplier_name ||
          "Unknown Supplier",

        risk_score:
          contract?.risk_score || 0,

        expiry_date:
          contract?.expiry_date ||
          null,

        value:
          contract?.value || 0,

        semantic_tags:
          generateContractTags(
            contract
          ),
      }));
  } catch (error) {
    console.error(
      "searchByRiskLevel() Error:",
      error.message
    );

    return [];
  }
}

/**
 * -----------------------------------------
 * SEARCH MISSING PROTECTIONS
 * -----------------------------------------
 */
export function searchMissingProtections(
  protection = "",
  contracts = []
) {
  try {
    const normalizedProtection =
      normalizeClauseType(
        protection
      );

    const results = [];

    for (const contract of contracts) {
      const clauses =
        contract?.clauses || [];

      const hasProtection =
        clauses.some((clause) =>
          normalizeClauseType(
            clause?.clause_type || ""
          ).includes(
            normalizedProtection
          )
        );

      if (!hasProtection) {
        results.push({
          contract_id:
            contract?.id || null,

          contract_name:
            contract?.name ||
            "Unnamed Contract",

          supplier:
            contract?.supplier_name ||
            "Unknown Supplier",

          missing_protection:
            normalizedProtection,

          risk_score:
            contract?.risk_score || 0,

          semantic_tags: [
            "missing_protection",
            normalizedProtection,
          ],
        });
      }
    }

    return results.sort(
      (a, b) =>
        b.risk_score - a.risk_score
    );
  } catch (error) {
    console.error(
      "searchMissingProtections() Error:",
      error.message
    );

    return [];
  }
}

/**
 * -----------------------------------------
 * SEARCH UPCOMING EXPIRATIONS
 * -----------------------------------------
 */
export function searchUpcomingExpirations(
  contracts = [],
  days = 90
) {
  try {
    const now = new Date();

    const futureDate =
      new Date();

    futureDate.setDate(
      now.getDate() + days
    );

    const results = [];

    for (const contract of contracts) {
      if (!contract?.expiry_date) {
        continue;
      }

      const expiryDate =
        new Date(
          contract.expiry_date
        );

      if (
        expiryDate >= now &&
        expiryDate <= futureDate
      ) {
        const remainingDays =
          Math.ceil(
            (expiryDate - now) /
              (1000 * 60 * 60 * 24)
          );

        results.push({
          contract_id:
            contract?.id || null,

          contract_name:
            contract?.name ||
            "Unnamed Contract",

          supplier:
            contract?.supplier_name ||
            "Unknown Supplier",

          expiry_date:
            contract?.expiry_date,

          days_remaining:
            remainingDays,

          risk_score:
            contract?.risk_score || 0,

          semantic_tags: [
            "expiration",
            "renewal",
          ],
        });
      }
    }

    return results.sort(
      (a, b) =>
        a.days_remaining -
        b.days_remaining
    );
  } catch (error) {
    console.error(
      "searchUpcomingExpirations() Error:",
      error.message
    );

    return [];
  }
}

/**
 * -----------------------------------------
 * SEARCH SUPPLIERS
 * -----------------------------------------
 */
export function searchSuppliers(
  query = "",
  contracts = []
) {
  try {
    const normalizedQuery =
      normalizeText(query);

    const supplierMap = {};

    for (const contract of contracts) {
      const supplier =
        contract?.supplier_name ||
        "Unknown Supplier";

      const normalizedSupplier =
        normalizeText(supplier);

      if (
        normalizedSupplier.includes(
          normalizedQuery
        )
      ) {
        if (
          !supplierMap[supplier]
        ) {
          supplierMap[supplier] = {
            supplier,

            contracts: 0,

            cumulative_risk: 0,

            total_contract_value: 0,

            contracts_list: [],
          };
        }

        supplierMap[
          supplier
        ].contracts += 1;

        supplierMap[
          supplier
        ].cumulative_risk +=
          Number(
            contract?.risk_score || 0
          );

        supplierMap[
          supplier
        ].total_contract_value +=
          Number(
            contract?.value || 0
          );

        supplierMap[
          supplier
        ].contracts_list.push({
          contract_id:
            contract?.id || null,

          contract_name:
            contract?.name ||
            "Unnamed Contract",

          risk_score:
            contract?.risk_score || 0,
        });
      }
    }

    return Object.values(
      supplierMap
    ).map((supplier) => ({
      ...supplier,

      average_risk_score:
        Math.round(
          supplier.cumulative_risk /
            supplier.contracts
        ),
    }));
  } catch (error) {
    console.error(
      "searchSuppliers() Error:",
      error.message
    );

    return [];
  }
}

/**
 * -----------------------------------------
 * SEARCH HIGH-RISK TERMS
 * -----------------------------------------
 */
export function searchHighRiskTerms(
  contracts = []
) {
  try {
    const results = [];

    for (const contract of contracts) {
      const clauses =
        contract?.clauses || [];

      for (const clause of clauses) {
        const text = normalizeText(
          clause?.clause_text || ""
        );

        for (const term of HIGH_RISK_TERMS) {
          if (
            text.includes(
              normalizeText(term)
            )
          ) {
            results.push({
              contract_id:
                contract?.id || null,

              contract_name:
                contract?.name ||
                "Unnamed Contract",

              supplier:
                contract?.supplier_name ||
                "Unknown Supplier",

              clause_type:
                clause?.clause_type ||
                "Unknown",

              detected_term: term,

              risk_score:
                contract?.risk_score || 0,

              semantic_tags: [
                "high_risk",
                "legal_exposure",
              ],

              matched_text:
                truncateText(
                  clause?.clause_text ||
                    "",
                  300
                ),
            });
          }
        }
      }
    }

    return results.sort(
      (a, b) =>
        b.risk_score - a.risk_score
    );
  } catch (error) {
    console.error(
      "searchHighRiskTerms() Error:",
      error.message
    );

    return [];
  }
}

/**
 * -----------------------------------------
 * SEARCH COMPLIANCE CLAUSES
 * -----------------------------------------
 */
export function searchComplianceClauses(
  framework = "",
  contracts = []
) {
  try {
    const normalizedFramework =
      normalizeText(framework);

    const results = [];

    for (const contract of contracts) {
      const clauses =
        contract?.clauses || [];

      for (const clause of clauses) {
        const text = normalizeText(
          clause?.clause_text || ""
        );

        const type = normalizeText(
          clause?.clause_type || ""
        );

        if (
          text.includes(
            normalizedFramework
          ) ||
          type.includes(
            normalizedFramework
          )
        ) {
          results.push({
            contract_id:
              contract?.id || null,

            contract_name:
              contract?.name ||
              "Unnamed Contract",

            supplier:
              contract?.supplier_name ||
              "Unknown Supplier",

            framework,

            clause_type:
              clause?.clause_type,

            semantic_tags: [
              "compliance",
              framework,
            ],

            matched_text:
              truncateText(
                clause?.clause_text ||
                  "",
                300
              ),
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error(
      "searchComplianceClauses() Error:",
      error.message
    );

    return [];
  }
}

/**
 * -----------------------------------------
 * HELPERS
 * -----------------------------------------
 */

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(
  text = "",
  limit = 300
) {
  if (text.length <= limit) {
    return text;
  }

  return (
    text.substring(0, limit) + "..."
  );
}

function normalizeClauseType(
  type = ""
) {
  const value = normalizeText(type);

  if (
    value.includes("liability")
  ) {
    return "limitation_of_liability";
  }

  if (
    value.includes("insurance")
  ) {
    return "insurance";
  }

  if (
    value.includes("indemn")
  ) {
    return "indemnity";
  }

  if (
    value.includes("confidential")
  ) {
    return "confidentiality";
  }

  if (
    value.includes("termination")
  ) {
    return "termination";
  }

  if (
    value.includes("compliance") ||
    value.includes("gdpr") ||
    value.includes("faa") ||
    value.includes("easa") ||
    value.includes("imo")
  ) {
    return "compliance";
  }

  return value
    .replace(/\s+/g, "_")
    .trim();
}

function calculateRelevance(
  query,
  searchable
) {
  let score = 0;

  const queryTerms =
    query.split(" ");

  for (const term of queryTerms) {
    if (
      searchable.includes(term)
    ) {
      score += 10;
    }
  }

  return score;
}

function generateSemanticTags(
  clause = {}
) {
  const tags = [];

  const text = normalizeText(
    clause?.clause_text || ""
  );

  const type = normalizeClauseType(
    clause?.clause_type || ""
  );

  tags.push(type);

  for (const term of SEARCHABLE_COMPLIANCE_TERMS) {
    if (text.includes(term)) {
      tags.push(term);
    }
  }

  if (
    text.includes(
      "unlimited liability"
    ) ||
    text.includes(
      "uncapped liability"
    )
  ) {
    tags.push("high_risk");
  }

  if (
    text.includes("insurance")
  ) {
    tags.push("insurance");
  }

  if (
    text.includes("indemn")
  ) {
    tags.push("indemnity");
  }

  return [...new Set(tags)];
}

function generateContractTags(
  contract = {}
) {
  const tags = [];

  const clauses =
    contract?.clauses || [];

  for (const clause of clauses) {
    const clauseTags =
      generateSemanticTags(
        clause
      );

    tags.push(...clauseTags);
  }

  return [...new Set(tags)];
      }
