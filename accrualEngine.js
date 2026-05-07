import { query } from "./db.js";

/**
 * Operion Maintenance Accrual Engine
 * -----------------------------------
 * Applies maintenance reserve accruals
 * based on aircraft flight activity.
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
    // Get ownership profile
    // ===============================
    const aircraftResult = await query(
      `
      SELECT
        a.id AS aircraft_id,
        op.ownership_type
      FROM aircraft a
      JOIN ownership_profiles op
        ON op.aircraft_id = a.id
      WHERE a.id = $1
      `,
      [aircraftId]
    );

    if (aircraftResult.rows.length === 0) {
      throw new Error(
        "Aircraft not found or ownership profile missing"
      );
    }

    const aircraft = aircraftResult.rows[0];

    // ===============================
    // Get maintenance reserves
    // ===============================
    const reservesResult = await query(
      `
      SELECT
        id,
        reserve_type,
        rate_per_flight_hour,
        accumulated_amount
      FROM maintenance_reserves
      WHERE aircraft_id = $1
      `,
      [aircraftId]
    );

    if (reservesResult.rows.length === 0) {
      throw new Error(
        "No maintenance reserves configured"
      );
    }

    // ===============================
    // Apply accruals
    // ===============================
    for (const reserve of reservesResult.rows) {

      const increment =
        Number(reserve.rate_per_flight_hour) *
        Number(flightHours);

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

      console.log("💰 Reserve updated", {
        reserveType: reserve.reserve_type,
        increment
      });
    }

    // ===============================
    // Success log
    // ===============================
    console.log("===================================");
    console.log("🧮 Maintenance accrual completed");
    console.log("Aircraft:", aircraftId);
    console.log("Ownership:", aircraft.ownership_type);
    console.log("Flight Hours:", flightHours);
    console.log(
      "Reserves Updated:",
      reservesResult.rows.length
    );
    console.log("===================================");

    return {
      success: true,
      aircraftId,
      ownershipType: aircraft.ownership_type,
      flightHours,
      reservesUpdated:
        reservesResult.rows.length
    };

  } catch (error) {

    console.error("===================================");
    console.error("❌ Accrual Engine Error");
    console.error(error.message);
    console.error("===================================");

    throw error;
  }
}
