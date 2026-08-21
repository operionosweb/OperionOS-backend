import assert from "node:assert/strict";
import test from "node:test";

import { createUserAuthMiddleware } from "../middleware/userAuthMiddleware.js";
import {
  createOrganizationMiddleware,
} from "../middleware/organizationMiddleware.js";
import {
  hasOrganizationPermission,
  requireOrganizationPermission,
} from "../middleware/authorizationMiddleware.js";

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("authenticateUser rejects requests without a bearer token", () => {
  const response = responseDouble();
  const authenticateUser = createUserAuthMiddleware();
  authenticateUser({ headers: {} }, response, () => {});

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, "Bearer token required");
});

test("authenticateUser rejects invalid tokens", async () => {
  const response = responseDouble();
  const authenticateUser = createUserAuthMiddleware(async () => {
    throw new Error("invalid");
  });

  await authenticateUser(
    { headers: { authorization: "Bearer invalid-token" } },
    response,
    () => {}
  );

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, "Invalid or expired token");
});

test("authenticateUser attaches verified Supabase user context", async () => {
  const request = { headers: { authorization: "Bearer valid-token" } };
  const response = responseDouble();
  let called = false;
  const authenticateUser = createUserAuthMiddleware(async (token) => {
    assert.equal(token, "valid-token");
    return {
      id: "user-id",
      email: "user@example.com",
      app_metadata: { role: "member" },
    };
  });

  await authenticateUser(request, response, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.deepEqual(request.user.id, "user-id");
  assert.equal(request.user.role, "member");
  assert.equal(request.auth.type, "supabase_user_token");
});

test("organization membership rejects malformed organization identifiers", async () => {
  const response = responseDouble();
  const requireMembership = createOrganizationMiddleware(async () => {
    throw new Error("query should not run");
  });

  await requireMembership(
    {
      user: { id: "user-id" },
      get: () => "not-a-uuid",
    },
    response,
    () => {}
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "x-org-id must be a valid organization UUID");
});

test("organization permissions come from the membership role", () => {
  assert.equal(hasOrganizationPermission("member", "contract:read"), true);
  assert.equal(hasOrganizationPermission("member", "contract:write"), false);
  assert.equal(hasOrganizationPermission("owner", "audit:export"), true);

  const response = responseDouble();
  const request = {
    organization: { id: "org-id" },
    auth: { organizationRole: "member" },
  };
  requireOrganizationPermission("contract:write")(request, response, () => {});

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "Insufficient organization permissions");
});

test("organization membership binds the query to both user and organization", async () => {
  const organizationId = "11111111-1111-4111-8111-111111111111";
  const request = {
    user: { id: "user-a" },
    requestId: "request-1",
    get: () => organizationId,
    auth: {},
  };
  const response = responseDouble();
  let queryParameters;
  const requireMembership = createOrganizationMiddleware(async (_sql, params) => {
    queryParameters = params;
    return {
      rows: [
        {
          id: organizationId,
          name: "Organization A",
          slug: "organization-a",
          role: "member",
        },
      ],
    };
  });

  await requireMembership(request, response, () => {});

  assert.deepEqual(queryParameters, [organizationId, "user-a"]);
  assert.equal(request.organization.id, organizationId);
  assert.equal(request.auth.organizationId, organizationId);
});

test("organization membership denies a user with no membership in the requested organization", async () => {
  const response = responseDouble();
  const requireMembership = createOrganizationMiddleware(async () => ({ rows: [] }));

  await requireMembership(
    {
      user: { id: "user-a" },
      get: () => "22222222-2222-4222-8222-222222222222",
      auth: {},
    },
    response,
    () => {}
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "Active organization membership required");
});
