import { logAudit } from "./db.js";

/* ===============================
   CREATE CONTRACT VERSION SNAPSHOT
=============================== */

export async function createContractVersion({
  supabase,
  file_id,
  company_id,
  clauses,
  risk_score,
  user_id
}) {
  const versionData = {
    file_id,
    company_id,
    clauses_snapshot: clauses,
    risk_score,
    created_at: new Date()
  };

  const { data, error } = await supabase
    .from("contract_versions")
    .insert([versionData])
    .select()
    .single();

  if (error) {
    throw new Error("Failed to create contract version");
  }

  await logAudit({
    user_id,
    company_id,
    action: "CONTRACT_VERSION_CREATED",
    entity_type: "contract_version",
    entity_id: data.id,
    metadata: {
      risk_score
    }
  });

  return data;
}

/* ===============================
   CLAUSE DIFF ENGINE
=============================== */

export function diffClauses(oldClauses = [], newClauses = []) {
  const oldMap = new Map();
  const newMap = new Map();

  oldClauses.forEach(c => {
    oldMap.set(c.type, c);
  });

  newClauses.forEach(c => {
    newMap.set(c.type, c);
  });

  const added = [];
  const removed = [];
  const modified = [];

  // added + modified
  for (const [type, clause] of newMap.entries()) {
    if (!oldMap.has(type)) {
      added.push(clause);
    } else {
      const old = oldMap.get(type);

      if (old.summary !== clause.summary || old.risk !== clause.risk) {
        modified.push({
          before: old,
          after: clause
        });
      }
    }
  }

  // removed
  for (const [type, clause] of oldMap.entries()) {
    if (!newMap.has(type)) {
      removed.push(clause);
    }
  }

  return {
    added,
    removed,
    modified
  };
}

/* ===============================
   RISK DELTA ENGINE
=============================== */

export function calculateRiskDelta(oldRisk = 0, newRisk = 0) {
  const delta = newRisk - oldRisk;

  return {
    delta,
    trend:
      delta > 5
        ? "RISK_INCREASED"
        : delta < -5
        ? "RISK_REDUCED"
        : "STABLE"
  };
}
