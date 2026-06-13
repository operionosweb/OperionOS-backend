import supabase from "../supabaseClient.js";

/**
 * =========================================
 * AIRLINE USAGE TRACKER (BILLING ENGINE)
 * =========================================
 */

export async function trackUsage({
  tenant,
  endpoint,
  tokens_used = 0,
  model = "unknown",
  cost_estimate = 0,
}) {
  try {
    const { error } = await supabase.from("usage_logs").insert([
      {
        org_id: tenant?.org_id,
        airline_id: tenant?.airline_id,
        request_id: tenant?.request_id,
        endpoint,
        tokens_used,
        model,
        cost_estimate,
        timestamp: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error("❌ USAGE TRACKING ERROR:", err.message);

    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * =========================================
 * SIMPLE COST ESTIMATOR (MVP)
 * =========================================
 */

export function estimateCost(tokens, model = "mistral") {
  const rates = {
    mistral: 0.0002,
    openrouter: 0.0003,
    openai: 0.0005,
  };

  const rate = rates[model] || 0.0003;

  return tokens * rate;
}