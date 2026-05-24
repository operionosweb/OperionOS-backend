// services/normalizationService.js

/**
 * OPERION OS
 * Normalization Service
 *
 * Responsibilities:
 * - Normalize contracts into entity tables
 * - Sync suppliers
 * - Sync clauses
 * - Sync obligations
 * - Sync risk scores
 * - Prepare platform for semantic/vector intelligence
 *
 * Tables:
 * - suppliers
 * - contract_clauses
 * - contract_obligations
 * - contract_risk_scores
 */

/**
 * Supabase
 */
import supabase from "../config/supabase.js";

/**
 * Services
 */
import {
  getAllContracts,
} from "./contractService.js";

import {
  calculateDeviationScore,
} from "./contractComparisonEngine.js";

/**
 * -----------------------------------------
 * MAIN NORMALIZATION PIPELINE
 * -----------------------------------------
 */
export async function normalizePortfolio() {
  try {
    const contracts =
      await getAllContracts();

    console.log(
      `Starting normalization for ${contracts.length} contracts...`
    );

    const results = {
      suppliers_synced: 0,
      clauses_synced: 0,
      obligations_synced: 0,
      risk_scores_synced: 0,
      errors: [],
    };

    /**
     * Process contracts sequentially
     */
    for (const contract of contracts) {
      try {
        const supplierId =
          await syncSupplier(
            contract,
            contracts
          );

        const clausesInserted =
          await syncClauses(
            contract,
            supplierId
          );

        const obligationsInserted =
          await syncObligations(
            contract,
            supplierId
          );

        await syncRiskScores(
          contract,
          contracts
        );

        results.suppliers_synced += 1;
        results.clauses_synced +=
          clausesInserted;

        results.obligations_synced +=
          obligationsInserted;

        results.risk_scores_synced += 1;
      } catch (contractError) {
        console.error(
          "Contract normalization error:",
          contractError
        );

        results.errors.push({
          contract_id:
            contract?.id || null,
          error:
            contractError.message,
        });
      }
    }

    console.log(
      "Normalization completed successfully."
    );

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error(
      "normalizePortfolio() Error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Normalization failed",
    };
  }
}

/**
 * -----------------------------------------
 * SUPPLIER SYNC
 * -----------------------------------------
 */
export async function syncSupplier(
  contract,
  allContracts
) {
  const supplierName =
    contract?.supplier_name ||
    contract?.vendor_name ||
    contract?.counterparty ||
    "Unknown Supplier";

  /**
   * Calculate supplier analytics
   */
  const supplierContracts =
    allContracts.filter((c) => {
      const name =
        c?.supplier_name ||
        c?.vendor_name ||
        c?.counterparty ||
        "Unknown Supplier";

      return name === supplierName;
    });

  const totalContracts =
    supplierContracts.length;

  const totalExposure =
    supplierContracts.reduce(
      (sum, c) =>
        sum +
        Number(
          c?.value ||
            c?.contract_value ||
            0
        ),
      0
    );

  const cumulativeRisk =
    supplierContracts.reduce(
      (sum, c) =>
        sum +
        Number(
          c?.risk_score || 0
        ),
      0
    );

  const averageRisk =
    totalContracts > 0
      ? Math.round(
          cumulativeRisk /
            totalContracts
        )
      : 0;

  const operationalBurden =
    supplierContracts.reduce(
      (sum, c) => {
        const obligations =
          c?.obligations || [];

        return (
          sum +
          obligations.length * 5
        );
      },
      0
    );

  /**
   * Upsert supplier
   */
  const {
    data,
    error,
  } = await supabase
    .from("suppliers")
    .upsert(
      {
        name: supplierName,

        industry:
          contract?.industry ||
          null,

        country:
          contract?.country ||
          null,

        risk_score:
          averageRisk,

        total_contracts:
          totalContracts,

        total_exposure:
          totalExposure,

        operational_burden_score:
          operationalBurden,
      },
      {
        onConflict: "name",
      }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data?.id || null;
}

/**
 * -----------------------------------------
 * CLAUSE SYNC
 * -----------------------------------------
 */
export async function syncClauses(
  contract,
  supplierId
) {
  const clauses =
    contract?.clauses || [];

  if (!clauses.length) {
    return 0;
  }

  /**
   * Delete previous clauses
   */
  await supabase
    .from("contract_clauses")
    .delete()
    .eq(
      "contract_id",
      contract.id
    );

  const clauseRows =
    clauses.map((clause) => ({
      contract_id:
        contract?.id,

      supplier_id:
        supplierId,

      clause_type:
        clause?.clause_type ||
        clause?.clause_title ||
        "General",

      normalized_clause_type:
        normalizeClauseType(
          clause?.clause_type ||
            clause?.clause_title ||
            "General"
        ),

      risk_level:
        clause?.risk_level ||
        "Medium",

      clause_text:
        clause?.clause_text ||
        "",

      semantic_tags:
        generateSemanticTags(
          clause
        ),
    }));

  const {
    error,
  } = await supabase
    .from("contract_clauses")
    .insert(clauseRows);

  if (error) {
    throw error;
  }

  return clauseRows.length;
}

/**
 * -----------------------------------------
 * OBLIGATION SYNC
 * -----------------------------------------
 */
export async function syncObligations(
  contract,
  supplierId
) {
  const obligations =
    contract?.obligations || [];

  if (!obligations.length) {
    return 0;
  }

  /**
   * Delete previous obligations
   */
  await supabase
    .from(
      "contract_obligations"
    )
    .delete()
    .eq(
      "contract_id",
      contract.id
    );

  const obligationRows =
    obligations.map(
      (obligation) => ({
        contract_id:
          contract?.id,

        supplier_id:
          supplierId,

        obligation_type:
          obligation?.type ||
          "General",

        title:
          obligation?.title ||
          obligation?.description ||
          "Untitled Obligation",

        description:
          obligation?.description ||
          "",

        severity:
          obligation?.severity ||
          obligation?.risk_level ||
          "Medium",

        deadline:
          obligation?.deadline ||
          null,

        status:
          obligation?.status ||
          "Pending",
      })
    );

  const {
    error,
  } = await supabase
    .from(
      "contract_obligations"
    )
    .insert(
      obligationRows
    );

  if (error) {
    throw error;
  }

  return obligationRows.length;
}

/**
 * -----------------------------------------
 * RISK SCORE SYNC
 * -----------------------------------------
 */
export async function syncRiskScores(
  contract,
  portfolio
) {
  /**
   * Delete previous risk scores
   */
  await supabase
    .from(
      "contract_risk_scores"
    )
    .delete()
    .eq(
      "contract_id",
      contract.id
    );

  const deviation =
    calculateDeviationScore(
      contract,
      portfolio
    );

  const riskPayload = {
    contract_id:
      contract?.id,

    overall_risk_score:
      Number(
        contract?.risk_score || 0
      ),

    financial_risk_score:
      extractFinancialRisk(
        contract
      ),

    operational_risk_score:
      extractOperationalRisk(
        contract
      ),

    compliance_risk_score:
      extractComplianceRisk(
        contract
      ),

    supplier_risk_score:
      extractSupplierRisk(
        contract
      ),

    deviation_score:
      deviation?.deviation_score ||
      0,
  };

  const {
    error,
  } = await supabase
    .from(
      "contract_risk_scores"
    )
    .insert(riskPayload);

  if (error) {
    throw error;
  }

  return true;
}

/**
 * -----------------------------------------
 * HELPERS
 * -----------------------------------------
 */

function normalizeClauseType(
  type = ""
) {
  const value = type
    .toLowerCase()
    .trim();

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
    value.includes(
      "confidential"
    )
  ) {
    return "confidentiality";
  }

  if (
    value.includes(
      "termination"
    )
  ) {
    return "termination";
  }

  if (
    value.includes(
      "compliance"
    ) ||
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

function generateSemanticTags(
  clause = {}
) {
  const tags = [];

  const type =
    normalizeClauseType(
      clause?.clause_type ||
        ""
    );

  tags.push(type);

  const text = (
    clause?.clause_text || ""
  ).toLowerCase();

  if (
    text.includes("gdpr")
  ) {
    tags.push("gdpr");
  }

  if (
    text.includes("faa")
  ) {
    tags.push("faa");
  }

  if (
    text.includes("easa")
  ) {
    tags.push("easa");
  }

  if (
    text.includes("imo")
  ) {
    tags.push("imo");
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

  return [
    ...new Set(tags),
  ];
}

function extractFinancialRisk(
  contract
) {
  const value = Number(
    contract?.value ||
      contract?.contract_value ||
      0
  );

  if (value >= 10000000)
    return 90;

  if (value >= 5000000)
    return 75;

  if (value >= 1000000)
    return 50;

  return 25;
}

function extractOperationalRisk(
  contract
) {
  const obligations =
    contract?.obligations || [];

  return Math.min(
    100,
    obligations.length * 5
  );
}

function extractComplianceRisk(
  contract
) {
  const clauses =
    contract?.clauses || [];

  let score = 0;

  for (const clause of clauses) {
    const text = (
      clause?.clause_text || ""
    ).toLowerCase();

    if (
      text.includes("gdpr")
    ) {
      score += 20;
    }

    if (
      text.includes("faa")
    ) {
      score += 20;
    }

    if (
      text.includes("easa")
    ) {
      score += 20;
    }

    if (
      text.includes("imo")
    ) {
      score += 20;
    }
  }

  return Math.min(
    100,
    score
  );
}

function extractSupplierRisk(
  contract
) {
  return Number(
    contract?.risk_score || 0
  );
}
