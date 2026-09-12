import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assertResourceId } from "../repositories/phase3/scope.js";
import { buildLegacyExtractionCacheKey } from "../services/aiExtractionService.js";
import { toSafeHttpError } from "../utils/safeHttpError.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => readFileSync(path.join(ROOT, relativePath), "utf8");

test("legacy media upload is removed from the application surface", () => {
  const indexSource = source("index.js");

  assert.doesNotMatch(indexSource, /mediaRoutes|\/api\/media/);
  assert.equal(existsSync(path.join(ROOT, "routes", "mediaRoutes.js")), false);
  assert.equal(existsSync(path.join(ROOT, "services", "storageService.js")), false);
  assert.equal(existsSync(path.join(ROOT, "services", "storage", "storageService.js")), false);
  assert.equal(existsSync(path.join(ROOT, "services", "storage", "providers", "uploadcareProvider.js")), false);
  assert.doesNotMatch(source("package.json"), /@uploadcare\/upload-client/);
  assert.doesNotMatch(source("routes/providerRoutes.js"), /uploadcare|UPLOADCARE_PUBLIC_KEY/i);
});

test("legacy JSON contract creation is disabled while canonical upload remains", () => {
  const routeSource = source("routes/contractRoutes.js");

  assert.doesNotMatch(routeSource, /router\.post\(\s*["']\/["']/);
  assert.match(routeSource, /router\.post\(\s*["']\/upload["']/);
  assert.match(routeSource, /router\.use\(authenticateUser, requireOrganizationMembership\)/);
  assert.match(routeSource, /organizationId:\s*req\.organization\.id/);
  assert.match(routeSource, /userId:\s*req\.user\.id/);
});

test("canonical document storage remains private and organization namespaced", () => {
  const storageSource = source("services/documentStorageService.js");
  const migrationSource = source("supabase/migrations/008_contract_upload_docx.sql");

  assert.match(storageSource, /organizations\/\$\{organizationId\}\/documents\/\$\{documentId\}\/versions\/\$\{versionId\}/);
  assert.match(storageSource, /\.download\(storageKey\)/);
  assert.doesNotMatch(storageSource, /getPublicUrl|ucarecdn|uploadcare/i);
  assert.match(migrationSource, /contract_storage_member_read/);
  assert.match(migrationSource, /is_organization_member/);
});

test("legacy cache identities cannot cross organization boundaries", () => {
  const organizationA = "11111111-1111-4111-8111-111111111111";
  const organizationB = "22222222-2222-4222-8222-222222222222";
  const contractText = "Synthetic aircraft lease";

  assert.notEqual(
    buildLegacyExtractionCacheKey(organizationA, contractText),
    buildLegacyExtractionCacheKey(organizationB, contractText)
  );
  assert.throws(
    () => buildLegacyExtractionCacheKey("manipulated-organization", contractText),
    (error) => error.code === "ORGANIZATION_ACCESS_DENIED"
  );
});

test("internal errors are redacted from external responses", () => {
  const internal = Object.assign(
    new Error("password=secret storage_key=organizations/private postgres failure"),
    { code: "PGRST_INTERNAL", status: 503 }
  );
  const response = toSafeHttpError(internal, {
    status: 500,
    code: "DOCUMENT_REQUEST_FAILED",
    message: "The document request could not be completed",
  });

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    success: false,
    code: "DOCUMENT_REQUEST_FAILED",
    error: "The document request could not be completed",
  });
  assert.doesNotMatch(JSON.stringify(response.body), /secret|storage_key|postgres|PGRST/i);
});

test("invalid resource identifiers fail before repository access", () => {
  assert.throws(() => assertResourceId("not-a-resource-id", "contractId"), /valid UUID/);
});

test("authentication middleware does not log headers or credentials", () => {
  const legacyAuthSource = source("middleware/authMiddleware.js");
  const apiKeyAuthSource = source("middleware/apiKeyMiddleware.js");

  assert.doesNotMatch(legacyAuthSource, /HEADERS RECEIVED|Extracted API key|console\.log/);
  assert.doesNotMatch(apiKeyAuthSource, /console\.(?:log|error)\([^)]*(?:receivedKey|expectedKey|req\.headers)/s);
});