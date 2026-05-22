// ======================================================
// AI OBLIGATION NORMALIZER
// ======================================================

export function extractObligations(clauses) {
  const obligations = [];

  clauses.forEach((clause) => {
    if (!clause.obligations) return;

    clause.obligations.forEach((o) => {
      obligations.push({
        clause_id: clause.clause_number,
        obligation_text: o.obligation_text,
        responsible_party: o.responsible_party,
        obligation_type: o.obligation_type,
        confidence: o.confidence || 0.5,
        is_explicit: o.is_explicit ?? true,
      });
    });
  });

  return obligations;
}
