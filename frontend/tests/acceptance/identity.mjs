import { createHash } from "node:crypto";
import { z } from "zod";

export const IDENTITY_SCHEMA = "operion-acceptance-identity/v1";
export const SERVICE_ROLES = Object.freeze(["postgres", "rest", "auth", "storage", "backend", "frontend"]);
export const CANONICAL_MIGRATIONS = Object.freeze([
  "001_phase1_foundation.sql",
  "002_secure_document_ingestion.sql",
  "003_phase3a_foundation.sql",
  "004_phase3b_clause_identity_atomicity.sql",
  "005_phase3c_obligation_identity_atomicity.sql",
  "006_ai_intelligence_foundation.sql",
  "007_contract_intelligence_technical_foundation.sql",
  "008_contract_upload_docx.sql",
  "009_document_structure_pages.sql",
  "010_semantic_obligation_fields.sql",
  "011_deadline_temporal_intelligence.sql",
  "012_contract_risk_intelligence.sql",
  "013_nonproduction_validation_hardening.sql",
  "014_durable_ai_state_hardening.sql",
  "015_aviation_intelligence_foundation.sql",
  "016_contract_intelligence_core.sql",
  "017_platform_identity_foundation.sql",
  "018_commercial_intelligence_mvp.sql",
  "019_customer_role_foundation.sql",
  "020_superadmin_intelligence_core.sql",
  "021_supervised_source_ingestion.sql",
]);

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const label = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/);
const timestamp = z.string().refine((value) => (
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
));
const endpoint = z.string().max(200).refine((value) => {
  try {
    const url = new URL(value);
    return url.hostname === "127.0.0.1" && !url.username && !url.password
      && !url.search && !url.hash && url.href === value;
  } catch {
    return false;
  }
});
const service = z.object({
  id: uuid, runtimeId: uuid, imageSha256: sha256, endpoint,
}).strict();
const database = z.object({
  serviceId: uuid,
  systemIdentifier: z.string().refine((value) => /^[1-9][0-9]{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n),
  databaseOid: z.string().refine((value) => /^[1-9][0-9]{0,9}$/.test(value) && BigInt(value) <= 4294967295n),
  name: z.literal("postgres"),
}).strict();
const marker = z.object({
  markerId: uuid, environmentId: uuid, databaseGenerationId: uuid,
  schemaVersion: z.literal(1),
}).strict();

const manifestSchema = z.object({
  schema: z.literal(IDENTITY_SCHEMA),
  taskId: uuid, environmentId: uuid, databaseGenerationId: uuid,
  issuedAt: timestamp, expiresAt: timestamp,
  runtime: z.object({
    kind: z.literal("disposable-linux-vm"),
    ownerId: uuid, vmId: uuid, bootId: uuid, stackId: uuid,
    databaseVolumeId: uuid, storageVolumeId: uuid,
  }).strict(),
  services: z.object({
    postgres: service, rest: service, auth: service,
    storage: service, backend: service, frontend: service,
  }).strict(),
  database,
  control: marker,
  migrations: z.array(z.object({
    version: z.string().regex(/^\d{3}$/), file: label, sha256,
  }).strict()).length(21),
  databaseSchemaSha256: sha256,
  storage: z.object({
    serviceId: uuid, volumeId: uuid, bucketId: label, public: z.literal(false),
    sentinel: z.object({
      objectId: uuid,
      key: z.string().max(256).regex(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/)
        .refine((value) => value.split("/").every((part) => part !== "." && part !== "..")),
      sha256,
    }).strict(),
  }).strict(),
  application: z.object({
    sourceRevision: z.string().regex(/^[0-9a-f]{40}$/),
    adapterVersion: label,
    frontendBuildSha256: sha256,
    frontendConfig: z.object({
      apiEndpoint: endpoint, supabaseEndpoint: endpoint, anonKeySha256: sha256,
    }).strict(),
  }).strict(),
}).strict();

function invalidManifest() {
  const error = new Error("Acceptance identity manifest is invalid, expired, contradictory or unsupported; no identity is established.");
  error.code = "INVALID_ACCEPTANCE_IDENTITY_MANIFEST";
  throw error;
}

export function validateIdentityManifest(input, { nowMs } = {}) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) invalidManifest();
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) invalidManifest();
  const manifest = parsed.data;
  const issued = Date.parse(manifest.issuedAt);
  const expires = Date.parse(manifest.expiresAt);
  if (issued > nowMs || expires <= nowMs || expires <= issued || expires - issued > 86_400_000) invalidManifest();

  const { runtime, services, control, application } = manifest;
  const identities = [
    manifest.taskId, manifest.environmentId, manifest.databaseGenerationId,
    ...Object.entries(runtime).filter(([key]) => key !== "kind").map(([, value]) => value),
    ...SERVICE_ROLES.map((role) => services[role].id),
    control.markerId, manifest.storage.sentinel.objectId,
  ];
  if (new Set(identities).size !== identities.length
    || new Set(SERVICE_ROLES.map((role) => services[role].endpoint)).size !== SERVICE_ROLES.length
    || runtime.databaseVolumeId === runtime.storageVolumeId
    || SERVICE_ROLES.some((role) => services[role].runtimeId !== runtime.vmId)
    || manifest.database.serviceId !== services.postgres.id
    || manifest.storage.serviceId !== services.storage.id
    || manifest.storage.volumeId !== runtime.storageVolumeId
    || control.environmentId !== manifest.environmentId
    || control.databaseGenerationId !== manifest.databaseGenerationId) invalidManifest();

  const paths = { postgres: "/postgres", rest: "/rest/v1", auth: "/auth/v1", storage: "/storage/v1", backend: "/", frontend: "/" };
  const ports = { postgres: "54322", rest: "54321", auth: "54321", storage: "54321", backend: "10001", frontend: "4174" };
  for (const role of SERVICE_ROLES) {
    const url = new URL(services[role].endpoint);
    if (url.protocol !== (role === "postgres" ? "postgresql:" : "http:")
      || url.port !== ports[role] || url.pathname !== paths[role]) invalidManifest();
  }
  if (application.frontendConfig.apiEndpoint !== services.backend.endpoint
    || application.frontendConfig.supabaseEndpoint !== `${new URL(services.rest.endpoint).origin}/`
    || manifest.migrations.some((entry, index) => (
      entry.file !== CANONICAL_MIGRATIONS[index] || entry.version !== entry.file.slice(0, 3)
    ))) invalidManifest();
  return manifest;
}

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])]));
  }
  return value;
}

export function canonicalIdentityManifest(input, options) {
  return JSON.stringify(ordered(validateIdentityManifest(input, options)));
}

export function digestIdentityManifest(input, options) {
  return createHash("sha256").update(canonicalIdentityManifest(input, options), "utf8").digest("hex");
}
