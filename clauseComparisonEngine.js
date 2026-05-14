import { logAudit } from "./db.js";

/* ===============================
   NORMALIZE CLAUSES
=============================== */

function normalizeClauses(clauses = []) {
  return clauses.map((c) => ({
    title: (c.title || "").toLowerCase().trim(),
    text: (c.text || "").toLowerCase().trim(),
    risk_score: c.risk_score || 0,
    risk_reason: c.risk_reason || ""
  }));
}

/* ===============================
   FIND CLAUSE MATCH
=============================== */

function findMatch(clause, previousClauses) {
  return previousClauses.find((prev) => {
    return (
      prev.title === clause.title ||
      prev.text.includes(clause.text.slice(0, 40))
    );
  });
}

/* ===============================
   MAIN DIFF ENGINE
=============================== */

export async function compareContractVersions({
  supabase,
  contract_id,
  company_id,
  newVersion,
  oldVersion,
  user_id
}) {
  try {

    const newClauses = normalizeClauses(newVersion.clauses || []);
    const oldClauses = normalizeClauses(oldVersion?.clauses || []);

    const changes = {
      added: [],
      removed: [],
      modified: [],
      risk_increase: [],
      risk_decrease: []
    };

    /* ===============================
       DETECT ADDED + MODIFIED
    =============================== */

    for (const clause of newClauses) {
      const match = findMatch(clause, oldClauses);

      if (!match) {
        changes.added.push(clause);
        continue;
      }

      const riskDiff = clause.risk_score - match.risk_score;

      if (riskDiff > 10) {
        changes.risk_increase.push({
          clause,
          diff: riskDiff
        });
      }

      if (riskDiff < -10) {
        changes.risk_decrease.push({
          clause,
          diff: riskDiff
        });
      }

      if (riskDiff !== 0) {
        changes.modified.push({
          before: match,
          after: clause,
          diff: riskDiff
        });
      }
    }

    /* ===============================
       DETECT REMOVED CLAUSES
    =============================== */

    for (const oldClause of oldClauses) {
      const match = findMatch(oldClause, newClauses);

      if (!match) {
        changes.removed.push(oldClause);
      }
    }

    /* ===============================
       RISK SUMMARY
    =============================== */

    const oldRisk =
      oldClauses.reduce((s, c) => s + c.risk_score, 0) /
      (oldClauses.length || 1);

    const newRisk =
      newClauses.reduce((s, c) => s + c.risk_score, 0) /
      (newClauses.length || 1);

    const riskDelta = newRisk - oldRisk;

    /* ===============================
       STORE COMPARISON RESULT
    =============================== */

    const { data: comparison } = await supabase
      .from("contract_comparisons")
      .insert([
        {
          contract_id,
          company_id,
          old_risk: oldRisk,
          new_risk: newRisk,
          risk_delta: riskDelta,
          changes
        }
      ])
      .select()
      .single();

    /* ===============================
       AUDIT LOG
    =============================== */

    await logAudit({
      user_id,
      company_id,
      action: "CONTRACT_COMPARED",
      entity_type: "contract_comparison",
      entity_id: comparison?.id,
      metadata: {
        risk_delta: riskDelta,
        added: changes.added.length,
        removed: changes.removed.length,
        modified: changes.modified.length
      }
    });

    /* ===============================
       RESULT
    =============================== */

    return {
      success: true,
      comparison_id: comparison?.id,
      risk: {
        old: oldRisk,
        new: newRisk,
        delta: riskDelta
      },
      changes
    };

  } catch (err) {
    console.error("Comparison engine error:", err.message);
    throw new Error("Contract comparison failed");
  }
}
