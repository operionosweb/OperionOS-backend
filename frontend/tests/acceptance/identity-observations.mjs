import { createHash } from "node:crypto";
import { canonicalIdentityManifest, digestIdentityManifest, validateIdentityManifest, SERVICE_ROLES } from "./identity.mjs";

export const IDENTITY_DIMENSIONS = Object.freeze([
  "runtime", "database", "control", "services", "backend", "frontend", "storage",
]);

function failure(code) {
  const error = new Error(`Acceptance identity comparison refused (${code}); acceptance execution remains disabled.`);
  error.code = code;
  throw error;
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameJson(actual, expected) {
  if (actual === expected) return true;
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length
      && expected.every((entry, index) => sameJson(actual[index], entry));
  }
  if (!record(actual) || !record(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length
    && keys.every((key) => Object.hasOwn(actual, key) && sameJson(actual[key], expected[key]));
}

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (record(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])]));
  }
  return value;
}

function evidenceDigest(dimension, evidence) {
  return createHash("sha256").update(JSON.stringify(ordered({
    schema: "operion-acceptance-evidence/v1", dimension, evidence,
  })), "utf8").digest("hex");
}

function expectedEvidence(manifest) {
  const { runtime, services, database, control, application, storage } = manifest;
  const binding = {
    database, control, databaseVolumeId: runtime.databaseVolumeId,
  };
  return {
    runtime: {
      ...runtime,
      listeners: SERVICE_ROLES.map((role) => ({ role, ...services[role] })),
      noForwarding: true,
    },
    database: {
      ...binding, migrations: manifest.migrations, databaseSchemaSha256: manifest.databaseSchemaSha256,
    },
    control,
    services: ["rest", "auth", "storage"].map((role) => ({
      role, ...services[role], ...binding,
      storageVolumeId: role === "storage" ? runtime.storageVolumeId : null,
    })),
    backend: {
      service: services.backend, ...binding,
      sourceRevision: application.sourceRevision, adapterVersion: application.adapterVersion,
    },
    frontend: {
      service: services.frontend, sourceRevision: application.sourceRevision,
      buildSha256: application.frontendBuildSha256, config: application.frontendConfig,
    },
    storage,
  };
}

// This module has no approved authentication or nonce-consumption mechanism.
export function compareIdentityObservations(input, observations, {
  nowMs, challenge, trustAnchor,
} = {}) {
  const manifest = validateIdentityManifest(input, { nowMs });
  const digest = digestIdentityManifest(manifest, { nowMs });
  if (!record(trustAnchor) || trustAnchor.provenance !== "approved-provisioning"
    || trustAnchor.manifestSha256 !== digest
    || trustAnchor.vmId !== manifest.runtime.vmId
    || trustAnchor.bootId !== manifest.runtime.bootId
    || trustAnchor.stackId !== manifest.runtime.stackId) failure("IDENTITY_TRUST_ANCHOR_REQUIRED");
  if (!record(trustAnchor.observationSources)
    || Object.keys(trustAnchor.observationSources).length !== IDENTITY_DIMENSIONS.length
    || IDENTITY_DIMENSIONS.some((dimension) => (
      !Object.hasOwn(trustAnchor.observationSources, dimension)
      || typeof trustAnchor.observationSources[dimension] !== "string"
      || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(trustAnchor.observationSources[dimension])
    ))) failure("IDENTITY_TRUST_ANCHOR_REQUIRED");
  if (typeof challenge !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(challenge)) failure("IDENTITY_CHALLENGE_REQUIRED");
  if (!record(observations)
    || Object.keys(observations).some((key) => !IDENTITY_DIMENSIONS.includes(key))) failure("INVALID_IDENTITY_OBSERVATIONS");

  const expected = expectedEvidence(manifest);
  const dimensions = {};
  const fields = [
    "challenge", "databaseGenerationId", "dimension", "environmentId", "evidence",
    "evidenceSha256", "manifestSha256", "observedAtMs", "sourceId", "status",
    "taskId", "validUntilMs",
  ];
  for (const dimension of IDENTITY_DIMENSIONS) {
    const observation = observations[dimension];
    let code = null;
    if (!record(observation) || observation.status !== "available") code = "OBSERVATION_UNAVAILABLE";
    else if (!sameJson(Object.keys(observation).sort(), fields)) code = "INVALID_OBSERVATION_ENVELOPE";
    else if (typeof observation.sourceId !== "string"
      || observation.sourceId !== trustAnchor.observationSources[dimension]) code = "UNTRUSTED_OBSERVATION_SOURCE";
    else if (observation.manifestSha256 !== digest || observation.challenge !== challenge
      || observation.taskId !== manifest.taskId
      || observation.environmentId !== manifest.environmentId
      || observation.databaseGenerationId !== manifest.databaseGenerationId
      || observation.dimension !== dimension) code = "OBSERVATION_CONTEXT_MISMATCH";
    else if (!Number.isSafeInteger(observation.observedAtMs)
      || !Number.isSafeInteger(observation.validUntilMs)
      || observation.observedAtMs > nowMs
      || observation.observedAtMs < Date.parse(manifest.issuedAt)
      || observation.validUntilMs <= nowMs
      || observation.validUntilMs > Date.parse(manifest.expiresAt)
      || observation.validUntilMs <= observation.observedAtMs
      || observation.validUntilMs - observation.observedAtMs > 300_000) code = "STALE_OBSERVATION";
    else if (!sameJson(observation.evidence, expected[dimension])) code = "IDENTITY_MISMATCH";
    else if (observation.evidenceSha256 !== evidenceDigest(dimension, expected[dimension])) code = "EVIDENCE_DIGEST_MISMATCH";
    dimensions[dimension] = {
      status: "rejected",
      comparisonStatus: code ? "rejected" : "matched",
      code: code || "OBSERVER_AUTHENTICATION_UNAVAILABLE",
      evidenceConsistent: code === null,
      evidenceAuthenticated: false,
      evidenceFresh: false,
      authenticationCode: "OBSERVER_AUTHENTICATION_UNAVAILABLE",
      freshnessCode: "TRUSTED_REPLAY_PROTECTION_UNAVAILABLE",
    };
  }
  const evidenceConsistent = Object.values(dimensions).every((entry) => entry.evidenceConsistent);
  return {
    status: "rejected",
    comparisonStatus: evidenceConsistent ? "matched" : "rejected",
    manifestValid: true,
    evidenceConsistent,
    evidenceAuthenticated: false,
    evidenceFresh: false,
    dimensions,
    manifestSha256: digest,
    executionAllowed: false,
    infrastructureVerified: false,
  };
}

// An injected adapter must collect independently observed data; no default/live adapter exists here.
export function compareIdentityFromAdapter(input, { adapter, ...context } = {}) {
  const manifest = validateIdentityManifest(input, { nowMs: context.nowMs });
  // Check declared context shape/bindings, not its authenticity, before calling the reader.
  compareIdentityObservations(manifest, {}, context);
  if (typeof adapter !== "function") {
    return compareIdentityObservations(manifest, {}, context);
  }
  const observations = adapter(
    JSON.parse(canonicalIdentityManifest(manifest, { nowMs: context.nowMs })),
    Object.freeze({
      challenge: context.challenge, nowMs: context.nowMs,
      manifestSha256: digestIdentityManifest(manifest, { nowMs: context.nowMs }),
      taskId: manifest.taskId, environmentId: manifest.environmentId,
      databaseGenerationId: manifest.databaseGenerationId,
    }),
  );
  return compareIdentityObservations(manifest, observations, context);
}
