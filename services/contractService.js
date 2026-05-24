// services/contractService.js

import supabase from "../config/supabase.js";

import {
  analyzeContractText,
} from "./aiExtractionService.js";

/**
 * OPERION OS
 * Enterprise Contract Service
 *
 * Responsibilities:
 * - Contract persistence
 * - AI intelligence orchestration
 * - Dynamic upload analysis
 * - Portfolio-ready normalization
 * - Executive intelligence generation
 */

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
     * RAW INPUTS
     */
    const rawText =
      contractPayload.raw_text || "";

    const filename =
      contractPayload.name ||
      "Uploaded Contract";

    /**
     * -----------------------------------------
     * STEP 1
     * AI ANALYSIS
     * -----------------------------------------
     */

    const aiAnalysis =
      await analyzeContractText(
        rawText,
        {
          filename,
        }
      );

    if (!aiAnalysis.success) {
      throw new Error(
        aiAnalysis.error ||
          "AI analysis failed"
      );
    }

    /**
     * -----------------------------------------
     * STEP 2
     * BUILD DATABASE PAYLOAD
     * -----------------------------------------
     */

    const contractInsertPayload = {
      /**
       * Core
       */
      name: filename,

      supplier_name:
        aiAnalysis.supplier_name ||
        contractPayload.supplier_name ||
        "Unknown Supplier",

      contract_type:
        aiAnalysis.contract_type ||
        "Commercial Contract",

      /**
       * Dates
       */
      effective_date:
        aiAnalysis.effective_date ||
        null,

      expiry_date:
        aiAnalysis.expiry_date ||
        null,

      /**
       * Financials
       */
      value:
        Number(
          aiAnalysis.value || 0
        ),

      /**
       * Intelligence
       */
      risk_score:
        Number(
          aiAnalysis.risk_score || 0
        ),

      risk_level:
        aiAnalysis.risk_level ||
        "Medium",

      executive_summary:
        aiAnalysis.executive_summary ||
        "",

      /**
       * Structured intelligence
       */
      clauses:
        aiAnalysis.clauses || [],

      obligations:
        aiAnalysis.obligations || [],

      detected_compliance:
        aiAnalysis.detected_compliance ||
        [],

      missing_protections:
        aiAnalysis.missing_protections ||
        [],

      abnormal_terms:
        aiAnalysis.abnormal_terms ||
        [],

      /**
       * Intelligence scoring
       */
      operational_burden_score:
        Number(
          aiAnalysis.operational_burden_score ||
            0
        ),

      financial_risk_score:
        Number(
          aiAnalysis.financial_risk_score ||
            0
        ),

      compliance_risk_score:
        Number(
          aiAnalysis.compliance_risk_score ||
            0
        ),

      supplier_risk_score:
        Number(
          aiAnalysis.supplier_risk_score ||
            0
        ),

      /**
       * Raw upload
       */
      raw_text: rawText,

      created_at:
        new Date().toISOString(),
    };

    /**
     * -----------------------------------------
     * STEP 3
     * SAVE TO SUPABASE
     * -----------------------------------------
     */

    const {
      data,
      error,
    } = await supabase
      .from("contracts")
      .insert(
        contractInsertPayload
      )
      .select()
      .single();

    if (error) {
      console.error(
        "Supabase Insert Error:",
        error
      );

      throw error;
    }

    /**
     * -----------------------------------------
     * STEP 4
     * RETURN FULL INTELLIGENCE
     * -----------------------------------------
     */

    return {
      success: true,

      contract: data,

      intelligence: {
        executive_summary:
          aiAnalysis.executive_summary,

        risk_score:
          aiAnalysis.risk_score,

        risk_level:
          aiAnalysis.risk_level,

        clauses:
          aiAnalysis.clauses,

        obligations:
          aiAnalysis.obligations,

        compliance:
          aiAnalysis.detected_compliance,

        missing_protections:
          aiAnalysis.missing_protections,

        abnormal_terms:
          aiAnalysis.abnormal_terms,
      },
    };
  } catch (error) {
    console.error(
      "createContract Error:",
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
      "getAllContracts Error:",
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
  id
) {
  try {
    const {
      data,
      error,
    } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error(
      "getContractById Error:",
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
  id,
  updates = {}
) {
  try {
    /**
     * Re-run AI if raw text updated
     */
    if (updates.raw_text) {
      const aiAnalysis =
        await analyzeContractText(
          updates.raw_text,
          {
            filename:
              updates.name ||
              "Updated Contract",
          }
        );

      updates = {
        ...updates,

        supplier_name:
          aiAnalysis.supplier_name,

        contract_type:
          aiAnalysis.contract_type,

        effective_date:
          aiAnalysis.effective_date,

        expiry_date:
          aiAnalysis.expiry_date,

        value:
          aiAnalysis.value,

        risk_score:
          aiAnalysis.risk_score,

        risk_level:
          aiAnalysis.risk_level,

        executive_summary:
          aiAnalysis.executive_summary,

        clauses:
          aiAnalysis.clauses,

        obligations:
          aiAnalysis.obligations,

        detected_compliance:
          aiAnalysis.detected_compliance,

        missing_protections:
          aiAnalysis.missing_protections,

        abnormal_terms:
          aiAnalysis.abnormal_terms,

        operational_burden_score:
          aiAnalysis.operational_burden_score,

        financial_risk_score:
          aiAnalysis.financial_risk_score,

        compliance_risk_score:
          aiAnalysis.compliance_risk_score,

        supplier_risk_score:
          aiAnalysis.supplier_risk_score,
      };
    }

    const {
      data,
      error,
    } = await supabase
      .from("contracts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      contract: data,
    };
  } catch (error) {
    console.error(
      "updateContract Error:",
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
  id
) {
  try {
    const {
      error,
    } = await supabase
      .from("contracts")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "deleteContract Error:",
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
