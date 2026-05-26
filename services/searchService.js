// services/searchService.js

import { getAllContracts } from "./contractService.js";

/**
 * =========================================
 * SIMPLE SEMANTIC SEARCH ENGINE
 * =========================================
 */

function matchesQuery(contract, query) {
  if (!query) return true;

  const q = query.toLowerCase();

  const searchable = [
    contract.filename,
    contract.contract_type,
    contract.supplier_name,
    contract.summary,
    JSON.stringify(contract.clauses || []),
    JSON.stringify(contract.obligations || []),
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(q);
}

/**
 * =========================================
 * SEARCH CONTRACTS
 * =========================================
 */

export async function searchContracts({
  query = "",
  type = "",
  provider = "",
  minRisk = 0,
}) {
  try {
    const allContractsResult = await getAllContracts();

    const contracts = allContractsResult.contracts || [];

    let filtered = contracts.filter((contract) => {
      /**
       * QUERY
       */

      if (!matchesQuery(contract, query)) {
        return false;
      }

      /**
       * CONTRACT TYPE
       */

      if (
        type &&
        contract.contract_type !== type
      ) {
        return false;
      }

      /**
       * PROVIDER
       */

      if (
        provider &&
        contract.provider_used !== provider
      ) {
        return false;
      }

      /**
       * RISK SCORE
       */

      if (
        typeof contract.risk_score === "number" &&
        contract.risk_score < minRisk
      ) {
        return false;
      }

      return true;
    });

    /**
     * SORT BY RISK DESC
     */

    filtered.sort((a, b) => {
      return (b.risk_score || 0) - (a.risk_score || 0);
    });

    return {
      success: true,
      total_results: filtered.length,
      results: filtered,
    };

  } catch (error) {
    console.error("searchContracts Error:", error);

    return {
      success: false,
      error: error.message || "Search failed",
    };
  }
}
