import { query } from "./db.js";

/**
 * Operion Maintenance Accrual Engine (v2)
 * ----------------------------------------
 * Now fully DATA-DRIVEN using reserve_rules table.
 * No hardcoded multipliers anymore.
 */

export async function applyMaintenanceAccrual(
  aircraftId,
  flightHours
) {
  try {

    // ===============================
    // Validation
    // ===============================
    if (!aircraftId) {
      throw new Error("Missing aircraftId");
    }

    if (!flightHours || flightHours <= 0) {
      throw new Error("Invalid flightHours");
    }

    // ===============================
    // Get aircraft + model
    // ===============================
    const aircraftResult = await query(
      `
      SELECT id, model
      FROM aircraft
      WHERE id = $1
      `,
      [aircraftId]
    );

    if (aircraftResult.rows.length === 0) {
      throw new Error("Aircraft not found");
    }

    const aircraft = aircraftResult.rows[0];

    // ===============================
    // Get existing reserves
    // ===============================
    const reservesResult = await query(
      `
      SELECT
        id,
        category,
        reserve_type,
        accumulated_amount
      FROM maintenance_reserves
      WHERE aircraft_id = $1
      `,
      [aircraftId]
    );

    if (reservesResult.rows.length === 0) {
      throw new Error("No maintenance reserves configured");
    }

    // ===============================
    // Apply dynamic rules per reserve
    // ===============================
    for (const reserve of reservesResult.rows) {

      // Fetch rule from DB
      const ruleResult = await query(
        `
        SELECT rate_per_hour, multiplier
        FROM reserve_rules
        WHERE aircraft_model = $1
          AND category = $2
        LIMIT 1
        `,
        [aircraft.model, reserve.category]
      );

      const rule = ruleResult.rows[0];

      if (!rule) {
        console.log("⚠️ No rule found for category:", reserve.category);
        continue;
      }

      // ===============================
      // Calculate increment
      // ===============================
      const increment =
        Number(rule.rate_per_hour) *
        Number(flightHours) *
        Number(rule.multiplier);

      // ===============================
      // Update reserve
      // ===============================
      await query(
        `
        UPDATE maintenance_reserves
        SET
          accumulated_amount =
            COALESCE(accumulated_amount, 0) + $1,
          last_updated = now()
        WHERE id = $2
        `,
        [increment, reserve.id]
      );

      console.log("💰 Dynamic reserve updated", {
        aircraftId,
        model: aircraft.model,
        category: reserve.category,
        increment
      });
    }

    // ===============================
    // Success response
    // ===============================
    console.log("===================================");
    console.log("🧮 Maintenance accrual completed (v2)");
    console.log("Aircraft:", aircraftId);
    console.log("Flight Hours:", flightHours);
    console.log("===================================");

    return {
      success: true,
      aircraftId,
      flightHours,
      message: "Dynamic maintenance accrual applied"
    };

  } catch (error) {

    console.error("===================================");
    console.error("❌ Accrual Engine v2 Error");
    console.error(error.message);
    console.error("===================================");

    throw error;
  }
}
