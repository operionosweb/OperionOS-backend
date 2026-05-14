import { logAudit } from "./db.js";

/* ===============================
   GET LATEST VERSION
=============================== */

async function getLatestVersion(supabase, contract_id) {
  const { data, error } = await supabase
    .from("contract_versions")
    .select("*")
    .eq("contract_id", contract_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

/* ===============================
   GET ALL VERSIONS (TIMELINE)
=============================== */

async function getVersionTimeline(supabase, contract_id) {
  const { data } = await supabase
    .from("contract_versions")
    .select("*")
    .eq("contract_id", contract_id)
    .order("created_at", { ascending: true });

  return data || [];
}

/* ===============================
   GET COMPARISONS
=============================== */

async function getComparisons(supabase, contract_id) {
  const { data } = await supabase
    .from("contract_comparisons")
    .select("*")
    .eq("contract_id", contract_id)
    .order("created_at", { ascending: false });

  return data || [];
}

/* ===============================
   RISK TREND ENGINE
=============================== */

function buildRiskTrend(versions = []) {
  return versions.map((v) => ({
    version_id: v.id,
    date: v.created_at,
    risk: v.overall_risk || 0
  }));
}

/* ===============================
   CLAUSE RISK SUMMARY
=============================== */

function buildClauseHeatmap(clauses = []) {
  const map = {};

  for (const c of clauses || []) {
    const key = c.title || "unknown";

    if (!map[key]) {
      map[key] = {
        count: 0,
        avg_risk: 0,
        total: 0
      };
    }

    map[key].count += 1;
    map[key].total += c.risk_score || 0;
  }

  return Object.entries(map).map(([title, v]) => ({
    clause: title,
    avg_risk: v.total / v.count,
    frequency: v.count
  }));
}

/* ===============================
   MAIN DASHBOARD ENGINE
=============================== */

export async function getContractDashboard({
  supabase,
  contract_id,
  company_id,
  user_id
}) {
  try {

    /* ===============================
       FETCH DATA
    =============================== */

    const latest = await getLatestVersion(supabase, contract_id);
    const timeline = await getVersionTimeline(supabase, contract_id);
    const comparisons = await getComparisons(supabase, contract_id);

    /* ===============================
       BUILD METRICS
    =============================== */

    const riskTrend = buildRiskTrend(timeline);

    const latestClauses = latest?.clauses || [];

    const clauseHeatmap = buildClauseHeatmap(latestClauses);

    /* ===============================
       RISK SUMMARY
    =============================== */

    const latestRisk = latest?.overall_risk || 0;

    const previousRisk =
      timeline.length > 1
        ? timeline[timeline.length - 2]?.overall_risk || 0
        : latestRisk;

    const riskDelta = latestRisk - previousRisk;

    /* ===============================
       DASHBOARD OBJECT
    =============================== */

    const dashboard = {
      contract_id,

      latest_version: latest,

      risk: {
        current: latestRisk,
        previous: previousRisk,
        delta: riskDelta
      },

      risk_timeline: riskTrend,

      clause_heatmap: clauseHeatmap,

      comparisons: comparisons.slice(0, 10)
    };

    /* ===============================
       AUDIT LOG
    =============================== */

    await logAudit({
      user_id,
      company_id,
      action: "CONTRACT_DASHBOARD_VIEW",
      entity_type: "contract_dashboard",
      entity_id: contract_id,
      metadata: {
        latest_risk: latestRisk,
        delta: riskDelta
      }
    });

    /* ===============================
       RETURN
    =============================== */

    return {
      success: true,
      dashboard
    };

  } catch (err) {
    console.error("Dashboard engine error:", err.message);
    throw new Error("Dashboard generation failed");
  }
}
