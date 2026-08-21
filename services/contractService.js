// services/contractService.js

import crypto from "crypto";

import supabase from "../config/supabase.js";

import { ingestContract } from "./contractIngestionEngine.js";

import {
  calculatePortfolioRisk,
} from "./portfolioRiskEngine.js";

/**
 * =========================================
 * HELPERS
 * =========================================
 */

function generateId() {
  return crypto.randomUUID();
}

function requireOrganizationScope(organizationId) {
  if (!organizationId || typeof organizationId !== "string") {
    throw new TypeError("organizationId is required");
  }

  return organizationId;
}

/**
 * =========================================
 * CREATE CONTRACT
 * =========================================
 */

export async function createContract({
  text,
  filename = "contract.pdf",
  fileId = null,
  organizationId,
  userId,
}) {
  try {
    const { analyzeContractText } = await import("./aiExtractionService.js");
    const { generateEmbedding, storeEmbedding } = await import(
      "./vectorMemoryService.js"
    );

    requireOrganizationScope(organizationId);

    if (!userId || typeof userId !== "string") {
      return {
        success: false,
        error: "userId is required",
      };
    }

    /**
     * -----------------------------------------
     * VALIDATION
     * -----------------------------------------
     */

    if (!text || typeof text !== "string") {
      return {
        success: false,
        error: "Contract text is required",
      };
    }

    /**
     * -----------------------------------------
     * INGESTION ENGINE
     * -----------------------------------------
     */

    const ingestion = await ingestContract({
      text,
      filename,
      fileId,
    });

    if (!ingestion.success) {
      return ingestion;
    }

    /**
     * -----------------------------------------
     * AI ANALYSIS
     * -----------------------------------------
     */

    const intelligence = await analyzeContractText(
      text
    );

    if (!intelligence.success) {
      return intelligence;
    }

    /**
     * -----------------------------------------
     * NORMALIZED CONTRACT
     * -----------------------------------------
     */

    const contract = {
      id: generateId(),

      organization_id: organizationId,

      created_by: userId,

      title: filename,

      filename,

      file_id: fileId,

      contract_type:
        intelligence.analysis.contract_type,

      supplier_name:
        intelligence.analysis.supplier_name,

      summary:
        intelligence.analysis.summary,

      risk_score:
        intelligence.analysis.risk_score,

      contract_value:
        intelligence.analysis.contract_value,

      clauses:
        intelligence.analysis.clauses,

      obligations:
        intelligence.analysis.obligations,

      document_hash:
        ingestion.document_hash,

      provider_used:
        intelligence.provider_used,

      created_at:
        new Date().toISOString(),

      updated_at:
        new Date().toISOString(),
    };

    /**
     * -----------------------------------------
     * STORE CONTRACT
     * -----------------------------------------
     */

    const { data, error } = await supabase
      .from("contracts")
      .insert(contract)
      .select()
      .single();

    if (error) {
      throw error;
    }

    /**
     * -----------------------------------------
     * VECTOR MEMORY GENERATION
     * -----------------------------------------
     */

    try {
      const embeddingResult =
        await generateEmbedding(text);

      if (embeddingResult.success) {
        await storeEmbedding({
          contractId: data.id,
          documentHash: data.document_hash,
          embedding: embeddingResult.embedding,
          metadata: {
            filename: data.filename,
            contract_type:
              data.contract_type,
            supplier_name:
              data.supplier_name,
            risk_score:
              data.risk_score,
          },
        });

        console.log(
          "🧠 Vector memory stored:",
          data.id
        );
      }
    } catch (embeddingError) {
      console.error(
        "Embedding pipeline error:",
        embeddingError
      );
    }

    /**
     * -----------------------------------------
     * PORTFOLIO ANALYTICS
     * -----------------------------------------
     */

    let portfolioAnalytics = null;

    try {
      portfolioAnalytics =
        await calculatePortfolioRisk(organizationId);
    } catch (portfolioError) {
      console.error(
        "Portfolio analytics error:",
        portfolioError
      );
    }

    /**
     * -----------------------------------------
     * RESPONSE
     * -----------------------------------------
     */

    return {
      success: true,
      contract: data,
      portfolio_analytics:
        portfolioAnalytics,
    };
  } catch (error) {
    console.error("createContract error:", error);

    return {
      success: false,
      error:
        error.message ||
        "Contract creation failed",
    };
  }
}

/**
 * =========================================
 * GET ALL CONTRACTS
 * =========================================
 */

export async function getAllContracts(organizationId) {
  try {
    requireOrganizationScope(organizationId);

    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    return {
      success: true,
      total: data.length,
      contracts: data,
    };
  } catch (error) {
    console.error("getAllContracts error", { code: error.code || "STORAGE_ERROR" });

    return {
      success: false,
      code: "STORAGE_ERROR",
      error: "Contract lookup failed",
    };
  }
}

/**
 * =========================================
 * GET CONTRACT BY ID
 * =========================================
 */

export async function getContractById(id, organizationId) {
  try {
    requireOrganizationScope(organizationId);

    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      contract: data,
    };
  } catch (error) {
    console.error("getContractById error", { code: error.code || "CONTRACT_NOT_FOUND" });

    return {
      success: false,
      code: error.code === "STORAGE_ERROR" ? "STORAGE_ERROR" : "CONTRACT_NOT_FOUND",
      error: error.code === "STORAGE_ERROR" ? "Contract lookup failed" : "Contract not found",
    };
  }
}

/**
 * =========================================
 * UPDATE CONTRACT
 * =========================================
 */

export async function updateContract(
  id,
  updates = {},
  organizationId
) {
  try {
    requireOrganizationScope(organizationId);

    const {
      id: ignoredId,
      organization_id: ignoredOrganizationId,
      created_by: ignoredCreatedBy,
      ...allowedUpdates
    } = updates;

    const payload = {
      ...allowedUpdates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("contracts")
      .update(payload)
      .eq("id", id)
      .eq("organization_id", organizationId)
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
    console.error("updateContract error", { code: error.code || "CONTRACT_NOT_FOUND" });

    return {
      success: false,
      code: error.code === "STORAGE_ERROR" ? "STORAGE_ERROR" : "CONTRACT_NOT_FOUND",
      error: error.code === "STORAGE_ERROR" ? "Contract update failed" : "Contract not found",
    };
  }
}

/**
 * =========================================
 * DELETE CONTRACT
 * =========================================
 */

export async function deleteContract(id, organizationId) {
  try {
    requireOrganizationScope(organizationId);

    const { error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      throw error;
    }

    return {
      success: true,
      deleted_id: id,
    };
  } catch (error) {
    console.error("deleteContract error", { code: error.code || "CONTRACT_NOT_FOUND" });

    return {
      success: false,
      code: error.code === "STORAGE_ERROR" ? "STORAGE_ERROR" : "CONTRACT_NOT_FOUND",
      error: error.code === "STORAGE_ERROR" ? "Contract deletion failed" : "Contract not found",
    };
  }
}

/**
 * =========================================
 * PORTFOLIO ANALYTICS
 * =========================================
 */

export async function getPortfolioAnalytics(organizationId) {
  try {
    requireOrganizationScope(organizationId);

    const analytics =
      await calculatePortfolioRisk(organizationId);

    return {
      success: true,
      analytics,
    };
  } catch (error) {
    console.error(
      "getPortfolioAnalytics error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Portfolio analytics failed",
    };
  }
}
