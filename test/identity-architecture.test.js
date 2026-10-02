import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const read = (path) => fs.readFile(path, "utf8");

test("platform roles are stored separately from organization memberships", async () => {
  const migration = await read("supabase/migrations/017_platform_identity_foundation.sql");
  const customerRoleMigration = await read("supabase/migrations/019_customer_role_foundation.sql");
  const membershipChange = migration.slice(0, migration.indexOf("create table if not exists public.platform_user_roles"));
  assert.match(migration, /create table if not exists public\.platform_user_roles/);
  assert.match(migration, /'SUPERADMIN', 'OPERION_ADMIN', 'OPERION_ANALYST'/);
  assert.match(membershipChange, /'VIEWER', 'ANALYST', 'CONTRACT_MANAGER', 'ORG_ADMIN'/);
  assert.doesNotMatch(membershipChange, /SUPERADMIN/);
  assert.match(migration, /revoke all on public\.platform_user_roles from anon, authenticated/);
  assert.match(customerRoleMigration, /'CUSTOMER_ADMIN', 'CUSTOMER_USER'/);
  assert.doesNotMatch(customerRoleMigration, /SUPERADMIN/);
  assert.match(customerRoleMigration, /create policy contracts_member_select/);
  assert.match(customerRoleMigration, /drop policy if exists contract_storage_member_insert/);
  assert.doesNotMatch(customerRoleMigration, /for all/);
});

test("platform-internal APIs use authentication and the centralized SUPERADMIN guard", async () => {
  const files = [
    "routes/adminRoutes.js",
    "routes/systemRoutes.js",
    "routes/verificationRoutes.js",
    "routes/metricsRoutes.js",
  ];
  for (const file of files) {
    const source = await read(file);
    assert.match(source, /authenticateUser/);
    assert.match(source, /requireSuperAdmin/);
    assert.match(source, /router\.use\(authenticateUser, requireSuperAdmin\)/);
  }

  const commercial = await read("routes/commercialIntelligenceRoutes.js");
  assert.match(commercial, /COMMERCIAL_INTELLIGENCE_READ/);
  assert.match(commercial, /COMMERCIAL_INTELLIGENCE_WRITE/);
  assert.match(commercial, /router\.use\(authenticate, authorizeRead\)/);
  assert.match(commercial, /router\.post\("\/companies", authorizeWrite/);
});

test("frontend restores authoritative roles and protects the internal route", async () => {
  const [auth, organization, app, layout, boundary, intelligence] = await Promise.all([
    read("frontend/src/context/AuthContext.jsx"),
    read("frontend/src/context/OrganizationContext.jsx"),
    read("frontend/src/App.jsx"),
    read("frontend/src/components/layout/ProductionLayout.jsx"),
    read("frontend/src/routes/CommercialIntelligenceBoundary.jsx"),
    read("frontend/src/routes/CommercialIntelligence.jsx"),
  ]);
  assert.match(auth, /apiRequest\("\/api\/platform\/context"\)/);
  assert.match(organization, /apiRequest\("\/api\/foundation\/context", \{ organizationId \}\)/);
  assert.match(app, /RequirePlatformPermission permission=\{PLATFORM_PERMISSIONS\.COMMERCIAL_INTELLIGENCE_READ\}/);
  assert.match(app, /RequireOrganizationPermission permission=\{ORGANIZATION_PERMISSIONS\.CONTRACT_WRITE\}/);
  assert.match(layout, /hasPlatformPermission\(PLATFORM_PERMISSIONS\.COMMERCIAL_INTELLIGENCE_READ\)/);
  assert.match(layout, /Operion internal/);
  assert.match(boundary, /CommercialIntelligence/);
  assert.match(intelligence, /Priority Opportunities/);
  assert.match(intelligence, /Build grounded reasoning/);
  assert.match(intelligence, /No sources linked\. Claims remain unverified/);

  const platformGuard = await read("frontend/src/components/auth/RequirePlatformPermission.jsx");
  assert.match(platformGuard, /403 Forbidden: Superadmin access is required/);
});

test("customer write and analysis controls are permission gated", async () => {
  const [workspace, contracts, dashboard] = await Promise.all([
    read("frontend/src/routes/ContractWorkspace.jsx"),
    read("frontend/src/routes/ProductionContracts.jsx"),
    read("frontend/src/routes/ProductionDashboard.jsx"),
  ]);
  assert.match(workspace, /CONTRACT_ANALYZE/);
  assert.match(workspace, /canAnalyze && analysisRun/);
  assert.match(workspace, /canAnalyze && <Button[^>]+handleObligationAnalysis/);
  assert.match(workspace, /canAnalyze && <Button[^>]+handleDeadlineAnalysis/);
  assert.match(workspace, /canAnalyze && <Button[^>]+handleRiskAnalysis/);
  assert.match(contracts, /CONTRACT_WRITE/);
  assert.match(dashboard, /CONTRACT_WRITE/);
});