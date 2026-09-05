import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { acceptanceStatePath } from "./environment.mjs";
import { apiRequest, cleanupFixtures, cleanupStaleFixtures, createClients, createTenant, uploadContract, writeDocx } from "./fixture-support.mjs";

const COMPLETED_TEXT = `SYNTHETIC AIRCRAFT LEASE AGREEMENT
Agreement Number: PW-LEASE-2026-001
This Aircraft Lease Agreement is between Synthetic Aviation Leasing Ltd. (the "Lessor") and Synthetic Airways Ltd. (the "Lessee").
Effective Date: 1 January 2026
Expiration Date: 31 December 2031
Aircraft Registration: G-PWA1
Aircraft MSN: 24680

1. MAINTENANCE AND AIRWORTHINESS
The Lessee shall maintain the Aircraft in an airworthy condition and notify the Lessor of material damage within five Business Days after discovery.

2. RETURN CONDITIONS
The Lessee shall return the Aircraft on the Expiration Date with all maintenance records complete.

3. LATE PAYMENT
Any rent unpaid for more than five calendar days after its due date incurs a late payment charge of EUR 10,000.

4. TERMINATION
The Lessor may terminate this Agreement for an uncured material default after thirty calendar days written notice.

5. INSURANCE
The Lessee shall maintain hull and aviation liability insurance throughout the Lease Term.`;

const PARTIAL_TEXT = `SYNTHETIC ENGINE MAINTENANCE AGREEMENT
1. INSPECTION SERVICES
The Maintenance Provider shall inspect the Engine within ten calendar days after written request.
2. RECORDS
The Maintenance Provider shall retain the inspection records during the Agreement term.`;

const NO_RISK_TEXT = `SYNTHETIC AVIATION SUPPORT AGREEMENT
Agreement Number: PW-SUPPORT-2026-001
1. ROUTINE REPORTING
The Supplier shall provide a routine service status report within ten calendar days after written request.
2. RECORD RETENTION
The Supplier shall retain service records during the Agreement term.`;

const BROWSER_UPLOAD_TEXT = `SYNTHETIC BROWSER AIRCRAFT LEASE AGREEMENT
Agreement Number: PW-BROWSER-2026-001
This Aircraft Lease Agreement is between Browser Aviation Leasing Ltd. (the "Lessor") and Browser Airways Ltd. (the "Lessee").
Effective Date: 1 February 2026
Expiration Date: 31 January 2032
Aircraft Registration: G-BROW
Aircraft MSN: 97531

1. MAINTENANCE
The Lessee shall maintain the Aircraft in an airworthy condition throughout the Lease Term.

2. RETURN
The Lessee shall return the Aircraft with complete maintenance records on the Expiration Date.`;

export default async function globalSetup() {
  const { admin, pool } = createClients();
  const runLabel = `playwright-acceptance-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const state = { runLabel, tenants: [], aircraftIds: [], contracts: {} };
  try {
    await cleanupStaleFixtures({ admin, pool });
    const tenantA = await createTenant({ admin, pool, runLabel, suffix: "a" });
    state.tenants.push(tenantA);
    const tenantB = await createTenant({ admin, pool, runLabel, suffix: "b" });
    state.tenants.push(tenantB);

    const aircraftId = randomUUID();
    await pool.query("insert into aircraft (id, registration, serial_number, manufacturer, model, data_source) values ($1, 'G-PWA1', '24680', 'Synthetic', 'Acceptance Test Aircraft', $2)", [aircraftId, runLabel]);
    await pool.query("insert into aircraft_organization_relationships (organization_id, aircraft_id, relationship_type, source_reference) values ($1, $2, 'leases', $3)", [tenantA.organizationId, aircraftId, runLabel]);
    state.aircraftIds.push(aircraftId);

    const fixtureDirectory = path.dirname(acceptanceStatePath);
    state.uploadFilePath = path.join(fixtureDirectory, "browser-upload.docx");
    state.unsupportedFilePath = path.join(fixtureDirectory, "unsupported.txt");
    await writeDocx(state.uploadFilePath, BROWSER_UPLOAD_TEXT);
    await fs.writeFile(state.unsupportedFilePath, "not a supported contract document");
    for (const [key, title, content] of [
      ["completed", "Synthetic Completed Aircraft Lease", COMPLETED_TEXT],
      ["partial", "Synthetic Partial Engine Agreement", PARTIAL_TEXT],
      ["emptyRisk", "Synthetic No-Risk Aviation Support", NO_RISK_TEXT],
    ]) {
      const filePath = path.join(fixtureDirectory, `${key}.docx`);
      await writeDocx(filePath, content);
      state.contracts[key] = await uploadContract({ filePath, tenant: tenantA, title });
    }

    const completedRoute = `/api/analysis-runs/${state.contracts.completed.analysisRunId}`;
    const completed = await apiRequest(`${completedRoute}/process`, { token: tenantA.token, organizationId: tenantA.organizationId, method: "POST" });
    if (completed.status !== 201 || completed.payload.status !== "completed") throw new Error(`Completed fixture failed: ${JSON.stringify(completed.payload)}`);

    const partial = await apiRequest(`/api/analysis-runs/${state.contracts.partial.analysisRunId}/clauses/analyze`, { token: tenantA.token, organizationId: tenantA.organizationId, method: "POST" });
    if (partial.status !== 201 || !partial.payload.clauses?.length) throw new Error(`Partial fixture failed: ${JSON.stringify(partial.payload)}`);

    const emptyRiskRoute = `/api/analysis-runs/${state.contracts.emptyRisk.analysisRunId}`;
    const emptyRisk = await apiRequest(`${emptyRiskRoute}/process`, { token: tenantA.token, organizationId: tenantA.organizationId, method: "POST" });
    if (emptyRisk.status !== 201 || emptyRisk.payload.status !== "completed") throw new Error(`No-risk fixture failed: ${JSON.stringify(emptyRisk.payload)}`);
    const emptyRisks = await apiRequest(`${emptyRiskRoute}/risks`, { token: tenantA.token, organizationId: tenantA.organizationId });
    if (emptyRisks.status !== 200 || emptyRisks.payload.risks.length !== 0) throw new Error("Synthetic no-risk fixture unexpectedly produced risks");

    const missingEvidenceAircraftId = randomUUID();
    await pool.query("insert into aircraft (id, registration, serial_number, manufacturer, model, data_source) values ($1, 'G-NOEV', 'NO-EVIDENCE', 'Synthetic', 'Missing Evidence Fixture', $2)", [missingEvidenceAircraftId, runLabel]);
    await pool.query("insert into aircraft_organization_relationships (organization_id, aircraft_id, relationship_type, source_reference) values ($1, $2, 'manages', $3)", [tenantA.organizationId, missingEvidenceAircraftId, runLabel]);
    await pool.query("insert into aircraft_contract_relationships (organization_id, aircraft_id, contract_id, relationship_type, active, confidence, source_reference) values ($1, $2, $3, 'supported_by', true, null, null)", [tenantA.organizationId, missingEvidenceAircraftId, state.contracts.completed.contractId]);
    state.aircraftIds.push(missingEvidenceAircraftId);

    await fs.mkdir(path.dirname(acceptanceStatePath), { recursive: true });
    await fs.writeFile(acceptanceStatePath, JSON.stringify(state), { mode: 0o600 });
  } catch (error) {
    await cleanupFixtures({ admin, pool, state });
    throw error;
  } finally {
    await pool.end();
  }
}