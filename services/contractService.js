// services/contractService.js

/**
 * OPERION OS
 * Contract Service
 *
 * Responsibilities:
 * - Contract ingestion
 * - AI orchestration
 * - Persistence
 * - Portfolio normalization
 */

/**
 * Supabase
 */
import supabase from "../config/supabase.js";

/**
 * AI Services
 */
import {
  parseClauses,
} from "./clauseParser.js";

import {
  parseObligations,
} from "./obligationParser.js";

import {
  calculateContractRisk,
} from "./contractRiskEngine.js";

import {
  benchmarkContract,
} from "./benchmarkEngine.js";

/**
 * Normalization
 */
import {
  normalizePortfolio,
} from "./normalizationService.js";

/**
 * -----------------------------------------
 * CREATE CONTRACT
 * -----------------------------------------
 */
export async function createContract(
  contractPayload = {}
) {
  try {
    /**
     * Validation
     */
    if (
      !contractPayload?.raw_text
    ) {
      throw new Error(
        "Contract raw_text is required"
      );
    }

    /**
     * STEP 1
     * Clause analysis
     */
    const clauses =
      await parseClauses(
        contractPayload.raw_text
      );

    /**
     * STEP 2
     * Obligation analysis
     */
    const obligations =
      await parseObligations(
        contractPayload.raw_text
      );

    /**
     * STEP 3
     * Risk analysis
     */
    const riskAnalysis =
      await calculateContractRisk({
        raw_text:
          contractPayload.raw_text,

        clauses,
        obligations,
      });

    /**
     * STEP 4
     * Benchmarking
     */
    const benchmark =
      await benchmarkContract({
        clauses,
        obligations,
      });

    /**
     * STEP 5
     * Build contract object
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
     * STEP 6
     * Save contract
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
     * STEP 7
     * Trigger normalization
     */
    try {
      console.log(
        "Starting normalization..."
      );

      await normalizePortfolio();

      console.log(
        "Normalization completed."
      );
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
export async function getAllContracts() {
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
export async function getContractById(
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
 * UPDATE CONTRACT
 * -----------------------------------------
 */
export async function updateContract(
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
     * Re-normalize
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
 * DELETE CONTRACT
 * -----------------------------------------
 */
export async function deleteContract(
  contractId
) {
  try {
    /**
     * Delete normalized entities
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
