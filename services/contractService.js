// services/contractService.js

import supabase from "../config/supabase.js";

/**
 * TEMP MINIMAL STABLE VERSION
 * Used to restore deployment stability
 */

export async function createContract(
  contractPayload = {}
) {
  try {
    const {
      data,
      error,
    } = await supabase
      .from("contracts")
      .insert({
        name:
          contractPayload.name ||
          "Unnamed Contract",

        supplier_name:
          contractPayload.supplier_name ||
          "Unknown Supplier",

        raw_text:
          contractPayload.raw_text ||
          "",

        created_at:
          new Date().toISOString(),
      })
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
