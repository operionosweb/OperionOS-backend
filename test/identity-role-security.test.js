import assert from "node:assert/strict";
import test from "node:test";

import express from "express";

import {
  ORGANIZATION_ROLES,
  hasOrganizationPermission,
} from "../middleware/authorizationMiddleware.js";
import {
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLES,
  createPlatformPermissionMiddleware,
} from "../middleware/superAdminMiddleware.js";
import { createCommercialIntelligenceRouter } from "../routes/commercialIntelligenceRoutes.js";

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function createTestApp(roleState) {
  const authenticate = (req, res, next) => {
    const userId = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!userId) return res.status(401).json({ success: false, error: "Bearer token required" });
    req.user = { id: userId };
    req.auth = { userId };
    return next();
  };
  const queryRoles = async (_sql, [userId]) => ({
    rows: (roleState.get(userId) || []).map((role) => ({ role })),
  });
  const authorize = createPlatformPermissionMiddleware(
    PLATFORM_PERMISSIONS.COMMERCIAL_INTELLIGENCE_READ,
    queryRoles
  );
  const repository = {
    listCompanies: async () => [],
    listSignals: async () => [],
    listOpportunities: async () => [],
  };
  return express().use(
    "/api/intelligence",
    createCommercialIntelligenceRouter({ authenticate, authorize, authorizeWrite: authorize, repository })
  );
}

test("customer organization roles have the minimum required permissions", () => {
  const expected = {
    [ORGANIZATION_ROLES.ORG_ADMIN]: [true, true, true],
    [ORGANIZATION_ROLES.CONTRACT_MANAGER]: [true, true, true],
    [ORGANIZATION_ROLES.ANALYST]: [true, false, true],
    [ORGANIZATION_ROLES.VIEWER]: [true, false, false],
  };

  for (const [role, permissions] of Object.entries(expected)) {
    assert.deepEqual([
      hasOrganizationPermission(role, "contract:read"),
      hasOrganizationPermission(role, "contract:write"),
      hasOrganizationPermission(role, "contract:analyze"),
    ], permissions, role);
  }
});

test("legacy organization roles retain conservative permission aliases", () => {
  assert.equal(hasOrganizationPermission("owner", "organization:write"), true);
  assert.equal(hasOrganizationPermission("owner", "audit:export"), true);
  assert.equal(hasOrganizationPermission("admin", "contract:analyze"), true);
  assert.equal(hasOrganizationPermission("admin", "audit:export"), false);
  assert.equal(hasOrganizationPermission("manager", "contract:write"), true);
  assert.equal(hasOrganizationPermission("member", "contract:write"), false);
});

test("only SUPERADMIN can cross the Commercial Intelligence API boundary", async () => {
  const roles = new Map([
    ["superadmin", [PLATFORM_ROLES.SUPERADMIN]],
    ["org-admin", []],
    ["contract-manager", []],
    ["analyst", []],
    ["viewer", []],
  ]);

  await withServer(createTestApp(roles), async (baseUrl) => {
    const access = await fetch(`${baseUrl}/api/intelligence/access`, {
      headers: { Authorization: "Bearer superadmin" },
    });
    assert.equal(access.status, 200);
    const accessBody = await access.json();
    assert.equal(accessBody.success, true);
    assert.equal(accessBody.boundary, "commercial_intelligence");
    assert.equal(accessBody.available, true);
    assert.equal(accessBody.intelligenceContext.rbiProfile.roleId, "OPERION_INTERNAL");

    const companies = await fetch(`${baseUrl}/api/intelligence/companies`, {
      headers: { Authorization: "Bearer superadmin" },
    });
    assert.equal(companies.status, 200);
    assert.deepEqual((await companies.json()).companies, []);

    for (const userId of ["org-admin", "contract-manager", "analyst", "viewer"]) {
      const response = await fetch(`${baseUrl}/api/intelligence/access`, {
        headers: { Authorization: `Bearer ${userId}` },
      });
      assert.equal(response.status, 403, userId);
    }

    assert.equal((await fetch(`${baseUrl}/api/intelligence/access`)).status, 401);
  });
});

test("platform role changes affect direct API authorization immediately", async () => {
  const roles = new Map([["operator", [PLATFORM_ROLES.SUPERADMIN]]]);

  await withServer(createTestApp(roles), async (baseUrl) => {
    const request = () => fetch(`${baseUrl}/api/intelligence/access`, {
      headers: { Authorization: "Bearer operator" },
    });
    assert.equal((await request()).status, 200);
    roles.set("operator", []);
    assert.equal((await request()).status, 403);
  });
});

test("SUPERADMIN receives platform administration permission", async () => {
  const response = { status: () => response, json: () => response };
  let allowed = false;
  const middleware = createPlatformPermissionMiddleware(
    PLATFORM_PERMISSIONS.PLATFORM_ADMIN,
    async () => ({ rows: [{ role: PLATFORM_ROLES.SUPERADMIN }] })
  );
  await middleware({ user: { id: "superadmin" }, auth: {} }, response, () => { allowed = true; });
  assert.equal(allowed, true);
});