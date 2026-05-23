// services/contractService.js

/**
 * OPERION OS
 * Contract Service
 *
 * Responsibilities:
 * - Contract ingestion
 * - Contract persistence
 * - AI analysis orchestration
 * - Portfolio normalization trigger
 */

/**
 * Supabase
 */
const supabase = require("../config/supabase");

/**
 * AI Services
 */
const {
  parseClauses,
} = require("./clauseParser");

const {
  parseObligations,
} = require("./obligationParser");

const {
  calculateContractRisk,
} = require("./contractRiskEngine");

const {
  benchmarkContract,
} = require("./benchmarkEngine");

/**
 * Normalization
 */
const {
  normalizePortfolio,
} = require("./normalizationService");

/**
 * -----------------------------------------
 * CREATE CONTRACT
 * -----------------------------------------
 */
async function createContract(
  contractPayload = {}
) {
  try {
    /**
     * Basic validation
     */
    if (
      !contractPayload?.raw_text
    ) {
      throw new Error(
        "Contract raw_text is required"
      );
    }

    /**
     * -------------------------------------
     * STEP 1 — CLAUSE ANALYSIS
     * -------------------------------------
     */
    const clauses =
      await parseClauses(
        contractPayload.raw_text
      );

    /**
     * -------------------------------------
     * STEP 2 — OBLIGATION ANALYSIS
     * -------------------------------------
     */
    const obligations =
      await parseObligations(
        contractPayload.raw_text
      );

    /**
     * -------------------------------------
     * STEP 3 — RISK ANALYSIS
     * -------------------------------------
     */
    const riskAnalysis =
      await calculateContractRisk({
        raw_text:
          contractPayload.raw_text,

        clauses,
        obligations,
      });

    /**
     * -------------------------------------
     * STEP 4 — BENCHMARKING
     * -------------------------------------
     */
    const benchmark =
      await benchmarkContract({
        clauses,
        obligations,
      });

    /**
     * -------------------------------------
     * STEP 5 — BUILD CONTRACT OBJECT
     * -------------------------------------
     */
    const contractData = {
      name:
        contractPayload?.name ||
        "Unnamed Contract",

      supplier_name:
        contractPayload?.supplier_name ||
        contractPayload?.vendor_name ||
        "Unknown Supplier",

      raw_text:
        contractPayload.raw_text,

      clauses,

      obligations,

      benchmark,

      risk_score:
        riskAnalysis
          ?.overall_risk_score || 0,

      risk_analysis:
        riskAnalysis,

      value:
        contractPayload?.value ||
        contractPayload?.contract_value ||
        0,

      expiry_date:
        contractPayload?.expiry_date ||
        null,

      metadata:
        contractPayload?.metadata ||
        {},

      created_at:
        new Date().toISOString(),
    };

    /**
     * -------------------------------------
     * STEP 6 — SAVE CONTRACT
     * -------------------------------------
     */
    const {
      data,
      error,
    } = await supabase
      .from("contracts")
      .insert(contractData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    /**
     * -------------------------------------
     * STEP 7 — TRIGGER NORMALIZATION
     * -------------------------------------
     */
    try {
      console.log(
        "Starting portfolio normalization..."
      );

      await normalizePortfolio();

      console.log(
        "Portfolio normalization completed."
      );
    } catch (
      normalizationError
    ) {
      console.error(
        "Normalization Error:",
        normalizationError
      );
    }

    /**
     * -------------------------------------
     * RETURN RESULT
     * -------------------------------------
     */
    return {
      success: true,

      contract: data,
    };
  } catch (error) {
    console.error(
      "createContract() Error:",
      error
    );

    return {
      success: false,

      error:
        error.message ||
        "Failed to create contract",
    };
  }
}

/**
 * -----------------------------------------
 * GET ALL CONTRACTS
 * -----------------------------------------
 */
async function getAllContracts() {
  try {
    const {
      data,
      error,
    } = await supabase
      .from("contracts")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error(
      "getAllContracts() Error:",
      error
    );

    return [];
  }
}

/**
 * -----------------------------------------
 * GET CONTRACT BY ID
 * -----------------------------------------
 */
async function getContractById(
  contractId
) {
  try {
    const {
      data,
      error,
    } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error(
      "getContractById() Error:",
      error
    );

    return null;
  }
}

/**
 * -----------------------------------------
 * DELETE CONTRACT
 * -----------------------------------------
 */
async function deleteContract(
  contractId
) {
  try {
    /**
     * Delete normalized entities first
     */
    await supabase
      .from("contract_clauses")
      .delete()
      .eq(
        "contract_id",
        contractId
      );

    await supabase
      .from(
        "contract_obligations"
      )
      .delete()
      .eq(
        "contract_id",
        contractId
      );

    await supabase
      .from(
        "contract_risk_scores"
      )
      .delete()
      .eq(
        "contract_id",
        contractId
      );

    /**
     * Delete contract
     */
    const {
      error,
    } = await supabase
      .from("contracts")
      .delete()
      .eq("id", contractId);

    if (error) {
      throw error;
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "deleteContract() Error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Failed to delete contract",
    };
  }
}

/**
 * -----------------------------------------
 * UPDATE CONTRACT
 * -----------------------------------------
 */
async function updateContract(
  contractId,
  updates = {}
) {
  try {
    const {
      data,
      error,
    } = await supabase
      .from("contracts")
      .update(updates)
      .eq("id", contractId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    /**
     * Re-normalize portfolio
     */
    try {
      await normalizePortfolio();
    } catch (
      normalizationError
    ) {
      console.error(
        "Normalization Error:",
        normalizationError
      );
    }

    return {
      success: true,
      contract: data,
    };
  } catch (error) {
    console.error(
      "updateContract() Error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Failed to update contract",
    };
  }
}

/**
 * -----------------------------------------
 * EXPORTS
 * -----------------------------------------
 */

module.exports = {
  createContract,
  getAllContracts,
  getContractById,
  updateContract,
  deleteContract,
};
