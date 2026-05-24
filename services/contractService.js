// services/contractService.js

import supabase from "../config/supabase.js";

import {
  analyzeContractText,
} from "./aiExtractionService.js";

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
     * Basic validation
     */
    if (
      !contractPayload?.raw_text
    ) {
      return {
        success: false,
        error:
          "raw_text is required",
      };
    }

    /**
     * -----------------------------------------
     * CACHE PROTECTION
     * Prevent duplicate AI processing
     * -----------------------------------------
     */
    const existing =
      await supabase
        .from("contracts")
        .select("*")
        .eq(
          "raw_text",
          contractPayload.raw_text
        )
        .maybeSingle();

    if (existing.data) {
      console.log(
        "Cached contract detected"
      );

      return {
        success: true,
        cached: true,
        contract:
          existing.data,
      };
    }

    /**
     * -----------------------------------------
     * AI EXTRACTION
     * -----------------------------------------
     */
    const analysis =
      await analyzeContractText(
        contractPayload.raw_text
      );

    /**
     * -----------------------------------------
     * BUILD CONTRACT RECORD
     * -----------------------------------------
     */
    const insertPayload = {
      name:
        contractPayload.name ||
        "Unnamed Contract",

      supplier_name:
        analysis?.supplier_name ||
        contractPayload
          ?.supplier_name ||
        "Unknown Supplier",

      contract_type:
        analysis?.contract_type ||
        "General Contract",

      summary:
        analysis?.summary || "",

      raw_text:
        contractPayload.raw_text,

      clauses:
        analysis?.clauses || [],

      obligations:
        analysis?.obligations ||
        [],

      risk_score:
        analysis?.risk_score || 0,

      contract_value:
        analysis?.contract_value ||
        0,

      created_at:
        new Date().toISOString(),
    };

    /**
     * -----------------------------------------
     * INSERT CONTRACT
     * -----------------------------------------
     */
    const {
      data,
      error,
    } = await supabase
      .from("contracts")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      cached: false,
      contract: data,
    };
  } catch (error) {
    console.error(
      "createContract Error:",
      error
    );

    return {
      success: false,
      error:
        error?.message ||
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
        error.message,
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
        error.message,
    };
  }
}
