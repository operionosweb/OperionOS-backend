import pool from "./db.js";

/**
 * Operion Maintenance Accrual Engine v1
 * --------------------------------------
 * Applies maintenance reserve accrual based on flight hours.
 * Supports both owned and leased aircraft (ownership-aware logic ready for expansion).
 */

export async function applyMaintenanceAccrual(aircraftId, flightHours) {
  try {
    if (!aircraftId) throw new Error("Missing aircraftId");
    if (!flightHours || flightHours <= 0) {
      throw new Error("Invalid flightHours");
    }

    // 1. Get aircraft + ownership info
    const aircraftResult = await pool.query(
      `
      SELECT 
        a.id AS aircraft_id,
        op.ownership_type
      FROM aircraft a
      JOIN ownership_profiles op ON op.aircraft_id = a.id
      WHERE a.id = $1
      `,
      [aircraftId]
    );

    if (aircraftResult.rows.length === 0) {
      throw new Error("Aircraft not found or missing ownership profile");
    }

    const aircraft = aircraftResult.rows[0];

    // 2. Get maintenance reserve rules
    const reservesResult = await pool.query(
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
      throw new Error("No maintenance reserves configured for this aircraft");
    }

    // 3. Apply accrual per reserve type
    for (const reserve of reservesResult.rows) {
      const increment = reserve.rate_per_flight_hour * flightHours;

      await pool.query(
        `
        UPDATE maintenance_reserves
        SET accumulated_amount = COALESCE(accumulated_amount, 0) + $1,
            last_updated = now()
        WHERE id = $2
        `,
        [increment, reserve.id]
      );
    }

    // 4. Logging (important for Render debugging)
    console.log("===================================");
    console.log("🧮 Maintenance Accrual Applied");
    console.log("Aircraft:", aircraftId);
    console.log("Ownership:", aircraft.ownership_type);
    console.log("Flight Hours:", flightHours);
    console.log("Reserves Updated:", reservesResult.rows.length);
    console.log("===================================");

    return {
      success: true,
      aircraftId,
      flightHours,
      ownershipType: aircraft.ownership_type,
      reservesUpdated: reservesResult.rows.length
    };
  } catch (error) {
    console.error("❌ Accrual Engine Error:", error.message);
    throw error;
  }
}
