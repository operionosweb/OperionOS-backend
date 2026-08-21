import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { Client } = pg;

const repositoryRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url))
);

const phase3Tables = [
  "contract_parties",
  "document_version_pages",
  "intelligence_evidence",
  "clauses",
  "obligations",
  "deadlines",
  "risks",
  "recommendations",
  "contract_search_chunks",
];

const relationshipTables = [
  "clause_evidence",
  "obligation_evidence",
  "deadline_evidence",
  "risk_evidence",
  "recommendation_evidence",
  "party_evidence",
];

const allReadableTables = [
  "contracts",
  "documents",
  "document_versions",
  "analysis_runs",
  ...phase3Tables,
  ...relationshipTables,
];

const compatibilityConstraints = [
  "documents_contract_organization_fk",
  "document_versions_document_organization_fk",
  "analysis_runs_contract_organization_fk",
  "analysis_runs_document_version_organization_fk",
];

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required test environment variable: ${name}`
    );
  }

  return value;
}

function projectRefFromUrl(url) {
  const parsed = new URL(url);
  return parsed.hostname.split(".")[0];
}

function loadSafeConfig() {
  if (process.env.PHASE3_DB_TEST_ENABLED !== "1") {
    throw new Error(
      "Refusing live verification: PHASE3_DB_TEST_ENABLED must equal 1"
    );
  }

  if (process.env.PHASE3_DB_ENV !== "non-production-test") {
    throw new Error(
      "Refusing live verification: PHASE3_DB_ENV must equal non-production-test"
    );
  }

  const projectRef = required("PHASE3_SUPABASE_PROJECT_REF");
  const supabaseUrl = required("SUPABASE_URL");

  if (
    /(^|[-_])prod(uction)?($|[-_])/.test(projectRef.toLowerCase())
  ) {
    throw new Error(
      "Refusing live verification: production-like environment marker detected"
    );
  }

  if (projectRefFromUrl(supabaseUrl) !== projectRef) {
    throw new Error(
      "Refusing live verification: Supabase project ref does not match SUPABASE_URL"
    );
  }

  return {
    databaseUrl: required("DATABASE_URL"),
    supabaseUrl,
    anonKey: required("SUPABASE_ANON_KEY"),
    serviceRoleKey: required("SUPABASE_TEST_SERVICE_ROLE_KEY"),
    applyMigrations: process.env.PHASE3_APPLY_MIGRATIONS === "1",
    emptyDatabase: process.env.PHASE3_EMPTY_DATABASE === "1",
    validateExistingForeignKeys:
      process.env.PHASE3_VALIDATE_EXISTING_FKS === "1",
  };
}

async function query(client, text, values = []) {
  return client.query(text, values);
}

async function expectQueryFailure(client, text, values = []) {
  await assert.rejects(() => query(client, text, values));
}

async function applyMigrations(client) {
  if (!process.env.PHASE3_APPLY_MIGRATIONS) {
    return;
  }

  if (process.env.PHASE3_EMPTY_DATABASE !== "1") {
    throw new Error(
      "Refusing migration application without PHASE3_EMPTY_DATABASE=1"
    );
  }

  const migrationFiles = [
    "001_phase1_foundation.sql",
    "002_secure_document_ingestion.sql",
    "003_phase3a_foundation.sql",
    "004_phase3b_clause_identity_atomicity.sql",
  ];

  for (const filename of migrationFiles) {
    const sql = await fs.readFile(
      path.join(
        repositoryRoot,
        "supabase",
        "migrations",
        filename
      ),
      "utf8"
    );

    await query(client, sql);
  }
}

async function verifySchema(
  client,
  validateExistingForeignKeys
) {
  const expectedTables = [
    "organizations",
    "organization_memberships",
    "contracts",
    "documents",
    "document_versions",
    "document_version_extractions",
    "analysis_runs",
    "audit_events",
    ...phase3Tables,
    ...relationshipTables,
  ];

  const tableResult = await query(
    client,
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])`,
    [expectedTables]
  );

  assert.deepEqual(
    new Set(tableResult.rows.map((row) => row.table_name)),
    new Set(expectedTables),
    "required Phase 2/3A tables are present"
  );

  const expectedColumns = {
    document_version_pages: [
      "organization_id",
      "contract_id",
      "document_id",
      "document_version_id",
      "analysis_run_id",
      "page_number",
      "text_content",
      "text_hash",
      "extraction_status",
    ],

    contract_parties: [
      "organization_id",
      "contract_id",
      "document_id",
      "document_version_id",
      "analysis_run_id",
      "name",
      "role",
      "confidence",
      "review_status",
    ],

    intelligence_evidence: [
      "organization_id",
      "contract_id",
      "document_id",
      "document_version_id",
      "analysis_run_id",
      "page_id",
      "excerpt",
      "char_start",
      "char_end",
      "stage",
      "provider",
      "model",
      "prompt_version",
      "pipeline_version",
      "confidence",
      "review_status",
      "evidence_hash",
    ],

    clauses: [
      "organization_id",
      "contract_id",
      "document_id",
      "document_version_id",
      "analysis_run_id",
      "title",
      "category",
      "source_text",
      "confidence",
      "review_status",
      "clause_identity",
    ],

    obligations: [
      "organization_id",
      "contract_id",
      "document_id",
      "document_version_id",
      "analysis_run_id",
      "clause_id",
      "description",
      "obligation_type",
      "confidence",
      "review_status",
    ],

    deadlines: [
      "organization_id",
      "contract_id",
      "document_id",
      "document_version_id",
      "analysis_run_id",
      "deadline_type",
      "original_expression",
      "normalized_date",
      "anchor_event",
      "offset_value",
      "offset_unit",
      "confidence",
      "review_status",
    ],

    risks: [
      "organization_id",
      "contract_id",
      "document_id",
      "document_version_id",
      "analysis_run_id",
      "risk_category",
      "severity",
      "probability",
      "score",
      "confidence",
      "review_status",
    ],

    recommendations: [
      "organization_id",
      "contract_id",
      "document_id",
      "document_version_id",
      "analysis_run_id",
      "recommendation_type",
      "action",
      "business_rationale",
      "urgency",
      "confidence",
      "review_status",
    ],

    contract_search_chunks: [
      "organization_id",
      "contract_id",
      "document_id",
      "document_version_id",
      "analysis_run_id",
      "chunk_index",
      "text_content",
      "text_hash",
      "search_vector",
      "index_status",
    ],
  };

  const columns = await query(
    client,
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1::text[])
        and column_name = any($2::text[])`,
    [
      phase3Tables,
      [...new Set(Object.values(expectedColumns).flat())],
    ]
  );

  for (const [table, tableColumns] of Object.entries(
    expectedColumns
  )) {
    for (const column of tableColumns) {
      assert.ok(
        columns.rows.some(
          (row) =>
            row.table_name === table &&
            row.column_name === column
        ),
        `${table}.${column} exists`
      );
    }
  }

  const indexes = await query(
    client,
    `select indexname
       from pg_indexes
      where schemaname = 'public'
        and indexname like 'phase3_%'`
  );

  assert.ok(
    indexes.rows.some(
      (row) => row.indexname === "phase3_chunks_search_idx"
    ),
    "phase3_chunks_search_idx exists"
  );

  const clauseIdentityConstraints = await query(
    client,
    `select conname
       from pg_constraint
      where conrelid = 'public.clauses'::regclass
        and conname = any($1::text[])`,
    [[
      "clauses_clause_identity_format_check",
      "clauses_document_version_run_identity_key",
    ]]
  );

  assert.ok(
    clauseIdentityConstraints.rows.some(
      (row) =>
        row.conname ===
        "clauses_clause_identity_format_check"
    ),
    "clause_identity format check exists"
  );

  assert.ok(
    clauseIdentityConstraints.rows.some(
      (row) =>
        row.conname ===
        "clauses_document_version_run_identity_key"
    ),
    "clause_identity uniqueness constraint exists"
  );

  const constraints = await query(
    client,
    `select conname, convalidated
       from pg_constraint
      where conname = any($1::text[])`,
    [compatibilityConstraints]
  );

  assert.equal(
    constraints.rows.length,
    compatibilityConstraints.length
  );

  if (validateExistingForeignKeys) {
    for (const constraint of compatibilityConstraints) {
      let table;

      if (constraint === "documents_contract_organization_fk") {
        table = "documents";
      } else if (
        constraint ===
        "document_versions_document_organization_fk"
      ) {
        table = "document_versions";
      } else {
        table = "analysis_runs";
      }

      await query(
        client,
        `alter table public.${table}
         validate constraint ${constraint}`
      );
    }
  }

  const rls = await query(
    client,
    `select c.relname, c.relrowsecurity
       from pg_class c
       join pg_namespace n
         on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = any($1::text[])`,
    [phase3Tables]
  );

  assert.equal(
    rls.rows.length,
    phase3Tables.length,
    "all Phase 3A tables have RLS metadata"
  );

  assert.ok(
    rls.rows.every((row) => row.relrowsecurity === true),
    "RLS is enabled on every Phase 3A table"
  );

  const policies = await query(
    client,
    `select tablename
       from pg_policies
      where schemaname = 'public'
        and policyname = 'phase3_member_select'`
  );

  assert.equal(
    policies.rows.length,
    phase3Tables.length + relationshipTables.length,
    "Phase 3A member-select policies exist on all intelligence and relationship tables"
  );

  const triggers = await query(
    client,
    `select tgname
       from pg_trigger
      where not tgisinternal
        and tgname in (
          'prevent_phase3_update',
          'prevent_analysis_run_invalid_transition'
        )`
  );

  assert.ok(
    triggers.rows.some(
      (row) => row.tgname === "prevent_phase3_update"
    ),
    "prevent_phase3_update trigger exists"
  );

  assert.ok(
    triggers.rows.some(
      (row) =>
        row.tgname ===
        "prevent_analysis_run_invalid_transition"
    ),
    "prevent_analysis_run_invalid_transition trigger exists"
  );
}

async function createUser(admin, suffix) {
  const email =
    `operion-phase3a-${suffix}-${crypto.randomUUID()}@example.invalid`;

  const password =
    `${crypto.randomUUID()}-TestOnly!`;

  const { data, error } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (error) {
    throw error;
  }

  return {
    id: data.user.id,
    email,
    password,
  };
}

async function seedTenant(client, user, label) {
  const ids = Object.fromEntries(
    [
      "organizationId",
      "contractId",
      "documentId",
      "versionId",
      "runId",
      "pageId",
      "partyId",
      "evidenceId",
      "clauseId",
      "obligationId",
      "deadlineId",
      "riskId",
      "recommendationId",
      "chunkId",
    ].map((name) => [
      name,
      crypto.randomUUID(),
    ])
  );

  const hash = crypto
    .createHash("sha256")
    .update(`${label}-${ids.evidenceId}`)
    .digest("hex");

  const sourceHash = crypto
    .createHash("sha256")
    .update(`${label}-source`)
    .digest("hex");

  const clauseText =
    `${label} maintenance clause`;

  await query(
    client,
    `insert into organizations
      (id, name, slug)
     values
      ($1, $2, $3)`,
    [
      ids.organizationId,
      `Operion Phase3A ${label}`,
      `operion-phase3a-${label.toLowerCase()}-${ids.organizationId}`,
    ]
  );

  await query(
    client,
    `insert into organization_memberships
      (organization_id, user_id, role)
     values
      ($1, $2, 'owner')`,
    [
      ids.organizationId,
      user.id,
    ]
  );

  await query(
    client,
    `insert into contracts
      (id, organization_id, created_by, title)
     values
      ($1, $2, $3, $4)`,
    [
      ids.contractId,
      ids.organizationId,
      user.id,
      `${label} synthetic aircraft lease`,
    ]
  );

  await query(
    client,
    `insert into documents
      (
        id,
        organization_id,
        contract_id,
        created_by,
        filename,
        mime_type,
        file_size,
        storage_key,
        sha256
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        'application/pdf',
        1,
        $6,
        $7
      )`,
    [
      ids.documentId,
      ids.organizationId,
      ids.contractId,
      user.id,
      `${label}.pdf`,
      `organizations/${ids.organizationId}/documents/${ids.documentId}/versions/${ids.versionId}/source.pdf`,
      sourceHash,
    ]
  );

  await query(
    client,
    `insert into document_versions
      (
        id,
        document_id,
        organization_id,
        version_number,
        sha256,
        storage_key,
        mime_type,
        file_size,
        extraction_status,
        created_by
      )
     values
      (
        $1,
        $2,
        $3,
        1,
        $4,
        $5,
        'application/pdf',
        1,
        'completed',
        $6
      )`,
    [
      ids.versionId,
      ids.documentId,
      ids.organizationId,
      sourceHash,
      `organizations/${ids.organizationId}/documents/${ids.documentId}/versions/${ids.versionId}/source.pdf`,
      user.id,
    ]
  );

  await query(
    client,
    `insert into analysis_runs
      (
        id,
        organization_id,
        contract_id,
        document_version_id,
        status,
        pipeline_version,
        requested_by
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        'queued',
        'phase3a-live-test',
        $5
      )`,
    [
      ids.runId,
      ids.organizationId,
      ids.contractId,
      ids.versionId,
      user.id,
    ]
  );

  await query(
    client,
    `insert into document_version_pages
      (
        id,
        organization_id,
        contract_id,
        document_id,
        document_version_id,
        analysis_run_id,
        page_number,
        text_content,
        text_length,
        text_hash
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        1,
        $7,
        $8,
        $9
      )`,
    [
      ids.pageId,
      ids.organizationId,
      ids.contractId,
      ids.documentId,
      ids.versionId,
      ids.runId,
      clauseText,
      clauseText.length,
      hash,
    ]
  );

  await query(
    client,
    `insert into contract_parties
      (
        id,
        organization_id,
        contract_id,
        document_id,
        document_version_id,
        analysis_run_id,
        name,
        normalized_name,
        role,
        confidence
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        'lessor',
        0.9
      )`,
    [
      ids.partyId,
      ids.organizationId,
      ids.contractId,
      ids.documentId,
      ids.versionId,
      ids.runId,
      `${label} Aircraft Leasing Ltd`,
      `${label.toLowerCase()} aircraft leasing ltd`,
    ]
  );

  await query(
    client,
    `insert into intelligence_evidence
      (
        id,
        organization_id,
        contract_id,
        document_id,
        document_version_id,
        analysis_run_id,
        page_id,
        page_number,
        excerpt,
        stage,
        pipeline_version,
        confidence,
        evidence_hash
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        1,
        $8,
        'clause',
        'phase3a-live-test',
        0.9,
        $9
      )`,
    [
      ids.evidenceId,
      ids.organizationId,
      ids.contractId,
      ids.documentId,
      ids.versionId,
      ids.runId,
      ids.pageId,
      clauseText,
      hash,
    ]
  );

  await query(
    client,
    `insert into clauses
      (
        id,
        organization_id,
        contract_id,
        document_id,
        document_version_id,
        analysis_run_id,
        clause_number,
        title,
        category,
        source_text,
        confidence
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        '7',
        'Maintenance',
        'maintenance',
        $7,
        0.9
      )`,
    [
      ids.clauseId,
      ids.organizationId,
      ids.contractId,
      ids.documentId,
      ids.versionId,
      ids.runId,
      clauseText,
    ]
  );

  await query(
    client,
    `insert into clause_evidence
      (
        organization_id,
        clause_id,
        evidence_id
      )
     values
      ($1, $2, $3)`,
    [
      ids.organizationId,
      ids.clauseId,
      ids.evidenceId,
    ]
  );

  await query(
    client,
    `insert into party_evidence
      (
        organization_id,
        party_id,
        evidence_id
      )
     values
      ($1, $2, $3)`,
    [
      ids.organizationId,
      ids.partyId,
      ids.evidenceId,
    ]
  );

  await query(
    client,
    `insert into obligations
      (
        id,
        organization_id,
        contract_id,
        document_id,
        document_version_id,
        analysis_run_id,
        clause_id,
        obligor_party_id,
        description,
        obligation_type,
        priority,
        confidence
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        'Maintain the aircraft',
        'maintenance',
        'high',
        0.9
      )`,
    [
      ids.obligationId,
      ids.organizationId,
      ids.contractId,
      ids.documentId,
      ids.versionId,
      ids.runId,
      ids.clauseId,
      ids.partyId,
    ]
  );

  await query(
    client,
    `insert into obligation_evidence
      (
        organization_id,
        obligation_id,
        evidence_id
      )
     values
      ($1, $2, $3)`,
    [
      ids.organizationId,
      ids.obligationId,
      ids.evidenceId,
    ]
  );

  await query(
    client,
    `insert into deadlines
      (
        id,
        organization_id,
        contract_id,
        document_id,
        document_version_id,
        analysis_run_id,
        obligation_id,
        deadline_type,
        original_expression,
        anchor_event,
        offset_value,
        offset_unit,
        confidence
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        'relative_deadline',
        'within 30 days after notice',
        'notice',
        30,
        'days',
        0.8
      )`,
    [
      ids.deadlineId,
      ids.organizationId,
      ids.contractId,
      ids.documentId,
      ids.versionId,
      ids.runId,
      ids.obligationId,
    ]
  );

  await query(
    client,
    `insert into deadline_evidence
      (
        organization_id,
        deadline_id,
        evidence_id
      )
     values
      ($1, $2, $3)`,
    [
      ids.organizationId,
      ids.deadlineId,
      ids.evidenceId,
    ]
  );

  await query(
    client,
    `insert into risks
      (
        id,
        organization_id,
        contract_id,
        document_id,
        document_version_id,
        analysis_run_id,
        clause_id,
        risk_category,
        severity,
        explanation,
        confidence
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        'maintenance/operational',
        'medium',
        'Maintenance exposure requires review',
        0.8
      )`,
    [
      ids.riskId,
      ids.organizationId,
      ids.contractId,
      ids.documentId,
      ids.versionId,
      ids.runId,
      ids.clauseId,
    ]
  );

  await query(
    client,
    `insert into risk_evidence
      (
        organization_id,
        risk_id,
        evidence_id
      )
     values
      ($1, $2, $3)`,
    [
      ids.organizationId,
      ids.riskId,
      ids.evidenceId,
    ]
  );

  await query(
    client,
    `insert into recommendations
      (
        id,
        organization_id,
        contract_id,
        document_id,
        document_version_id,
        analysis_run_id,
        risk_id,
        clause_id,
        recommendation_type,
        action,
        business_rationale,
        urgency,
        confidence
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        'review',
        'Review maintenance allocation',
        'Confirm responsibility before execution',
        'high',
        0.8
      )`,
    [
      ids.recommendationId,
      ids.organizationId,
      ids.contractId,
      ids.documentId,
      ids.versionId,
      ids.runId,
      ids.riskId,
      ids.clauseId,
    ]
  );

  await query(
    client,
    `insert into recommendation_evidence
      (
        organization_id,
        recommendation_id,
        evidence_id
      )
     values
      ($1, $2, $3)`,
    [
      ids.organizationId,
      ids.recommendationId,
      ids.evidenceId,
    ]
  );

  await query(
    client,
    `insert into contract_search_chunks
      (
        id,
        organization_id,
        contract_id,
        document_id,
        document_version_id,
        analysis_run_id,
        chunk_index,
        text_content,
        text_hash
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        0,
        $7,
        $8
      )`,
    [
      ids.chunkId,
      ids.organizationId,
      ids.contractId,
      ids.documentId,
      ids.versionId,
      ids.runId,
      clauseText,
      hash,
    ]
  );

  return {
    ...ids,
    evidenceHash: hash,
  };
}

async function verifyRls(clientFactory, tenants) {
  const userA = await clientFactory(tenants.userA);
  const userB = await clientFactory(tenants.userB);

  for (const table of allReadableTables) {
    const select = table.endsWith("_evidence")
      ? "*"
      : "id, organization_id";

    const [aResult, bResult] = await Promise.all([
      userA.from(table).select(select),
      userB.from(table).select(select),
    ]);

    if (aResult.error) {
      throw aResult.error;
    }

    if (bResult.error) {
      throw bResult.error;
    }

    assert.ok(
      aResult.data.length >= 1,
      `${table}: User A sees own data`
    );

    assert.ok(
      bResult.data.length >= 1,
      `${table}: User B sees own data`
    );

    assert.ok(
      aResult.data.every(
        (row) =>
          row.organization_id ===
          tenants.a.organizationId
      ),
      `${table}: User A sees only A`
    );

    assert.ok(
      bResult.data.every(
        (row) =>
          row.organization_id ===
          tenants.b.organizationId
      ),
      `${table}: User B sees only B`
    );
  }

  const crossTenantClauseEvidence =
    await userA.from("clause_evidence").insert({
      organization_id: tenants.a.organizationId,
      clause_id: tenants.a.clauseId,
      evidence_id: tenants.b.evidenceId,
    });

  assert.ok(
    crossTenantClauseEvidence.error,
    "authenticated cross-tenant clause_evidence insert is rejected"
  );

  const crossTenantPartyEvidence =
    await userA.from("party_evidence").insert({
      organization_id: tenants.a.organizationId,
      party_id: tenants.a.partyId,
      evidence_id: tenants.b.evidenceId,
    });

  assert.ok(
    crossTenantPartyEvidence.error,
    "authenticated cross-tenant party_evidence insert is rejected"
  );
}

async function verifyDatabaseControls(client, tenants) {
  await expectQueryFailure(
    client,
    `insert into clause_evidence
      (organization_id, clause_id, evidence_id)
     values
      ($1, $2, $3)`,
    [
      tenants.a.organizationId,
      tenants.a.clauseId,
      tenants.b.evidenceId,
    ]
  );

  await expectQueryFailure(
    client,
    `insert into party_evidence
      (organization_id, party_id, evidence_id)
     values
      ($1, $2, $3)`,
    [
      tenants.a.organizationId,
      tenants.a.partyId,
      tenants.b.evidenceId,
    ]
  );

  await expectQueryFailure(
    client,
    `insert into intelligence_evidence
      (
        id,
        organization_id,
        contract_id,
        document_id,
        document_version_id,
        analysis_run_id,
        excerpt,
        stage,
        pipeline_version,
        confidence,
        evidence_hash
      )
     values
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'duplicate',
        'test',
        'phase3a-live-test',
        0.5,
        $7
      )`,
    [
      crypto.randomUUID(),
      tenants.a.organizationId,
      tenants.a.contractId,
      tenants.a.documentId,
      tenants.a.versionId,
      tenants.a.runId,
      tenants.a.evidenceHash,
    ]
  );

  await expectQueryFailure(
    client,
    `update intelligence_evidence
        set excerpt = 'mutated'
      where id = $1`,
    [tenants.a.evidenceId]
  );

  await expectQueryFailure(
    client,
    `update clauses
        set title = 'mutated'
      where id = $1`,
    [tenants.a.clauseId]
  );

  await expectQueryFailure(
    client,
    `update obligations
        set description = 'mutated'
      where id = $1`,
    [tenants.a.obligationId]
  );

  await expectQueryFailure(
    client,
    `update deadlines
        set ambiguity = 'mutated'
      where id = $1`,
    [tenants.a.deadlineId]
  );

  await expectQueryFailure(
    client,
    `update risks
        set explanation = 'mutated'
      where id = $1`,
    [tenants.a.riskId]
  );

  await expectQueryFailure(
    client,
    `update recommendations
        set action = 'mutated'
      where id = $1`,
    [tenants.a.recommendationId]
  );

  await expectQueryFailure(
    client,
    `update analysis_runs
        set status = 'completed'
      where id = $1`,
    [tenants.a.runId]
  );

  for (const status of [
    "processing",
    "extracting",
    "analysing",
    "indexing",
    "completed",
  ]) {
    await query(
      client,
      `update analysis_runs
          set status = $1
        where id = $2`,
      [
        status,
        tenants.a.runId,
      ]
    );
  }

  await expectQueryFailure(
    client,
    `update analysis_runs
        set status = 'processing'
      where id = $1`,
    [tenants.a.runId]
  );
}

async function main() {
  const config = loadSafeConfig();

  const database = new Client({
    connectionString: config.databaseUrl,
  });

  const admin = createClient(
    config.supabaseUrl,
    config.serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const tenants = {};
  const users = [];

  await database.connect();

  try {
    if (config.applyMigrations) {
      await applyMigrations(database);
    }

    await verifySchema(
      database,
      config.validateExistingForeignKeys
    );

    users.push(await createUser(admin, "a"));
    users.push(await createUser(admin, "b"));

    tenants.userA = users[0];
    tenants.userB = users[1];

    tenants.a = await seedTenant(
      database,
      users[0],
      "A"
    );

    tenants.b = await seedTenant(
      database,
      users[1],
      "B"
    );

    const authenticatedClient = async (user) => {
      const client = createClient(
        config.supabaseUrl,
        config.anonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

      const { error } =
        await client.auth.signInWithPassword({
          email: user.email,
          password: user.password,
        });

      if (error) {
        throw error;
      }

      return client;
    };

    await verifyRls(
      authenticatedClient,
      tenants
    );

    await verifyDatabaseControls(
      database,
      tenants
    );

    console.log(
      "Phase 3A live verification passed for the dedicated non-production test environment"
    );
  } finally {
    // contracts.organization_id is ON DELETE RESTRICT,
    // so contracts must be removed first.
    if (tenants.a?.contractId) {
      await query(
        database,
        "delete from contracts where id = $1",
        [tenants.a.contractId]
      );
    }

    if (tenants.b?.contractId) {
      await query(
        database,
        "delete from contracts where id = $1",
        [tenants.b.contractId]
      );
    }

    if (tenants.a?.organizationId) {
      await query(
        database,
        "delete from organizations where id = $1",
        [tenants.a.organizationId]
      );
    }

    if (tenants.b?.organizationId) {
      await query(
        database,
        "delete from organizations where id = $1",
        [tenants.b.organizationId]
      );
    }

    for (const user of users) {
      await admin.auth.admin.deleteUser(user.id);
    }

    await database.end();
  }
}

main().catch((error) => {
  console.error(
    `Phase 3A live verification did not run: ${error.message}`
  );

  process.exitCode = 2;
});