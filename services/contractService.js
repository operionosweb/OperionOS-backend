// services/contractService.js

import supabase from "../config/supabase.js";

/**
 * -----------------------------------------
 * CREATE CONTRACT
 * -----------------------------------------
 */

export async function createContract(
  contractPayload = {}
) {
  try {
    const insertPayload = {
      name:
        contractPayload.name ||
        "Unnamed Contract",

      supplier_name:
        contractPayload.supplier_name ||
        "Unknown Supplier",

      raw_text:
        contractPayload.raw_text ||
        "",

      contract_type:
        contractPayload.contract_type ||
        "General Contract",

      summary:
        contractPayload.summary ||
        "",

      risk_score:
        Number(
          contractPayload.risk_score || 0
        ),

      value:
        Number(
          contractPayload.value || 0
        ),

      start_date:
        contractPayload.start_date ||
        null,

      expiry_date:
        contractPayload.expiry_date ||
        null,

      clauses:
        contractPayload.clauses || [],

      obligations:
        contractPayload.obligations ||
        [],

      created_at:
        new Date().toISOString(),
    };

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
      contract: data,
    };
  } catch (error) {
    console.error(
      "createContract Error:",
      error
    );

    return {
      success: false,
      error: error.message,
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
      error: error.message,
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
      error: error.message,
    };
  }
}
