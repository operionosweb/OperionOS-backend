import { cleanupFixtures, createClients, readAcceptanceState } from "./fixture-support.mjs";

export default async function globalTeardown() {
  const { admin, pool } = createClients();
  try {
    await cleanupFixtures({ admin, pool, state: await readAcceptanceState({ optional: true }) });
  } finally {
    await pool.end();
  }
}