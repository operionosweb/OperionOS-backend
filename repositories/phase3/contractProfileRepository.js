import pool from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "./scope.js";

export function createContractProfileRepository(pgPool = pool) {
  return {
    async getByRun({ organizationId, analysisRunId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(analysisRunId, "analysisRunId");
      const result = await pgPool.query(
        "select * from contract_intelligence_profiles where organization_id = $1 and analysis_run_id = $2",
        [organizationId, analysisRunId]
      );
      return result.rows[0] || null;
    },

    async listClauseSources({ organizationId, analysisRunId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(analysisRunId, "analysisRunId");
      const result = await pgPool.query(
        `select c.*, coalesce(jsonb_agg(e order by ce.rank) filter (where e.id is not null), '[]'::jsonb) as evidence
         from clauses c
         left join clause_evidence ce
           on ce.clause_id = c.id and ce.organization_id = c.organization_id
         left join intelligence_evidence e
           on e.id = ce.evidence_id and e.organization_id = ce.organization_id
         where c.organization_id = $1 and c.analysis_run_id = $2
         group by c.id
         order by c.clause_number asc`,
        [organizationId, analysisRunId]
      );
      return result.rows;
    },

    async persist({ scope, profile }) {
      assertOrganizationScope(scope.organizationId);
      [scope.contractId, scope.documentId, scope.documentVersionId, scope.analysisRunId].forEach((id) => assertResourceId(id, "profile scope id"));
      const client = await pgPool.connect();
      try {
        await client.query("begin");
        const existing = await client.query(
          "select * from contract_intelligence_profiles where organization_id = $1 and analysis_run_id = $2",
          [scope.organizationId, scope.analysisRunId]
        );
        if (existing.rows[0]) {
          await client.query("commit");
          return existing.rows[0];
        }

        const summary = profile.summary;
        let inserted = await client.query(
          `insert into contract_intelligence_profiles (
             organization_id, contract_id, document_id, document_version_id, analysis_run_id,
             metadata, classification, executive_summary, key_commercial_terms,
             key_operational_terms, key_obligations, key_deadlines, key_risks,
             unusual_or_missing_terms, recommendations, aircraft_identifiers,
             evidence_claims, confidence
           ) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18)
           on conflict (organization_id, analysis_run_id) do nothing
           returning *`,
          [
            scope.organizationId, scope.contractId, scope.documentId, scope.documentVersionId, scope.analysisRunId,
            JSON.stringify(profile.metadata), JSON.stringify(profile.classification), summary.executiveSummary,
            JSON.stringify(summary.keyCommercialTerms), JSON.stringify(summary.keyOperationalTerms),
            JSON.stringify(summary.keyObligations), JSON.stringify(summary.keyDeadlines), JSON.stringify(summary.keyRisks),
            JSON.stringify(summary.unusualOrMissingTerms), JSON.stringify(profile.recommendations),
            JSON.stringify(profile.aircraftIdentifiers), JSON.stringify(profile.evidenceClaims), profile.confidence,
          ]
        );
        if (!inserted.rows[0]) {
          inserted = await client.query(
            "select * from contract_intelligence_profiles where organization_id = $1 and analysis_run_id = $2",
            [scope.organizationId, scope.analysisRunId]
          );
        }

        const metadata = profile.metadata;
        await client.query(
          `update contracts set
             title = coalesce($3, title), contract_number = $4, contract_type = $5,
             contract_type_confidence = $6, effective_date = $7, expiry_date = $8,
             renewal_date = $9, auto_renewal = $10, governing_law = $11,
             currency = $12, source_document_id = $13, metadata_confidence = $14,
             updated_at = now()
           where organization_id = $1 and id = $2`,
          [scope.organizationId, scope.contractId, metadata.name, metadata.contractNumber, metadata.contractType,
            profile.classification.confidence, metadata.effectiveDate, metadata.expirationDate, metadata.renewalDate,
            metadata.autoRenewal, metadata.governingLaw, metadata.currency, scope.documentId, profile.confidence]
        );

        const partyClaim = profile.evidenceClaims.find((claim) => claim.field === "parties");
        for (const party of metadata.parties || []) {
          const partyResult = await client.query(
            `insert into contract_parties (
               organization_id, contract_id, document_id, document_version_id, analysis_run_id,
               name, normalized_name, role, party_type, is_primary, confidence, review_status
             ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,'pending')
             on conflict (document_version_id, analysis_run_id, normalized_name, role) do nothing
             returning id`,
            [scope.organizationId, scope.contractId, scope.documentId, scope.documentVersionId, scope.analysisRunId,
              party.name, party.name.toLowerCase().replace(/\s+/g, " ").trim(), party.role, party.type,
              partyClaim?.evidence?.confidence || 0.8]
          );
          if (partyResult.rows[0]?.id && partyClaim?.evidence?.evidenceId) {
            await client.query(
              `insert into party_evidence (organization_id, party_id, evidence_id, rank, support_type, is_primary)
               values ($1,$2,$3,1,'supports',true) on conflict do nothing`,
              [scope.organizationId, partyResult.rows[0].id, partyClaim.evidence.evidenceId]
            );
          }
        }
        await client.query("commit");
        return inserted.rows[0];
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}