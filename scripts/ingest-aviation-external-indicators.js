import pool from "../db.js";
import { createExternalAviationObservationRepository } from "../repositories/phase3/externalAviationObservationRepository.js";
import { createExternalAviationSignalService } from "../services/phase3/intelligence/externalAviationSignalService.js";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to persist external observations.");
  }
  const service = createExternalAviationSignalService();
  const repository = createExternalAviationObservationRepository(pool);
  const collection = await service.collectPublicObservations();
  const result = await repository.insertObservations(collection.observations);
  const sourceResults = Object.fromEntries(
    Object.entries(collection.sources).map(([category, source]) => [category, {
      status: source.status,
      sourceId: source.sourceId,
      fetched: collection.observations.filter((item) => item.category === category).length,
      failures: source.failures || [],
      reason: source.reason || null,
    }]),
  );
  console.info(JSON.stringify({
    retrievedAt: collection.retrievedAt,
    insertedObservationCount: result.inserted,
    sourceResults,
  }));
  if (Object.values(collection.sources).some((source) => ["partial", "unavailable"].includes(source.status) && source.sourceId !== "eia")) {
    process.exitCode = 1;
  }
}

main()
  .catch(() => {
    console.error("External aviation signal ingestion failed; inspect the configured database and source availability.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
