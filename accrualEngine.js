import { query } from "./db.js";

/**
 * Operion Maintenance Accrual Engine (v3)
 * ----------------------------------------
 * Now includes:
 * - Dynamic rules (DB-driven)
 * - Audit logging per calculation
 * - Full traceability
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
    // Get aircraft info
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
    // Get maintenance reserves
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
    // PROCESS EACH RESERVE
    // ===============================
    for (const reserve of reservesResult.rows) {

      // Fetch rule
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
        console.log("⚠️ No rule found:", reserve.category);
        continue;
      }

      const rate = Number(rule.rate_per_hour);
      const multiplier = Number(rule.multiplier);

      const increment =
        rate *
        Number(flightHours) *
        multiplier;

      // ===============================
      // Update reserve balance
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

      // ===============================
      // AUDIT LOG (NEW)
      // ===============================
      await query(
        `
        INSERT INTO accrual_audit_log (
          aircraft_id,
          flight_hours,
          category,
          rate_per_hour,
          multiplier,
          increment
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          aircraftId,
          flightHours,
          reserve.category,
          rate,
          multiplier,
          increment
        ]
      );

      console.log("📊 Audit logged:", {
        category: reserve.category,
        increment
      });
    }

    // ===============================
    // SUCCESS RESPONSE
    // ===============================
    console.log("===================================");
    console.log("🧮 Maintenance accrual completed (v3)");
    console.log("Aircraft:", aircraftId);
    console.log("Flight Hours:", flightHours);
    console.log("===================================");

    return {
      success: true,
      aircraftId,
      flightHours,
      message: "Dynamic accrual + audit logging completed"
    };

  } catch (error) {

    console.error("===================================");
    console.error("❌ Accrual Engine v3 Error");
    console.error(error.message);
    console.error("===================================");

    throw error;
  }
}
