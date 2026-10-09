import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { Pool } = pg;
const expectedMigrations = Array.from({ length: 21 }, (_, index) =>
  String(index + 1).padStart(3, "0")
);
const statusFile = process.argv[2];

assert.ok(statusFile, "Path to the local Supabase status environment file is required");

function parseEnvironment(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).replace(/^\uFEFF/, "").trim();
        const value = line.slice(separator + 1).replace(/^"(.*)"$/, "$1");
        return [key, value];
      })
  );
}

function assertLoopbackUrl(value, name) {
  assert.ok(value, `${name} is required`);
  const url = new URL(value);
  assert.ok(
    ["127.0.0.1", "localhost", "::1"].includes(url.hostname),
    `${name} must use a loopback host`
  );
  return url;
}

async function waitForResetEmail(mailpitUrl, email) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch(new URL("/api/v1/messages", mailpitUrl));
    assert.equal(response.status, 200, "Mailpit message listing failed");
    const payload = await response.json();
    const message = payload.messages?.find((candidate) =>
      candidate.To?.some((recipient) => recipient.Address === email)
    );
    if (message) {
      const detailResponse = await fetch(
        new URL(`/api/v1/message/${encodeURIComponent(message.ID)}`, mailpitUrl)
      );
      assert.equal(detailResponse.status, 200, "Mailpit message retrieval failed");
      return detailResponse.json();
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local password reset email was not delivered to Mailpit");
}

async function main() {
  const localEnvironment = parseEnvironment(await fs.readFile(statusFile, "utf8"));
  const apiUrl = assertLoopbackUrl(localEnvironment.API_URL, "API_URL").origin;
  const databaseUrl = assertLoopbackUrl(localEnvironment.DB_URL, "DB_URL").toString();
  const mailpitUrl = assertLoopbackUrl(
    localEnvironment.INBUCKET_URL || localEnvironment.MAILPIT_URL,
    "MAILPIT_URL"
  ).origin;
  const anonKey = localEnvironment.ANON_KEY;
  const serviceRoleKey = localEnvironment.SERVICE_ROLE_KEY;
  assert.ok(anonKey, "ANON_KEY is required");
  assert.ok(serviceRoleKey, "SERVICE_ROLE_KEY is required");

  const nativeFetch = globalThis.fetch;
  const contactedOrigins = new Set();
  globalThis.fetch = (input, init) => {
    const requestUrl = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url
    );
    assert.ok(
      ["127.0.0.1", "localhost", "::1"].includes(requestUrl.hostname),
      `Blocked non-loopback request to ${requestUrl.origin}`
    );
    contactedOrigins.add(requestUrl.origin);
    return nativeFetch(input, init);
  };

  process.env.SUPABASE_URL = apiUrl;
  process.env.SUPABASE_ANON_KEY = anonKey;
  process.env.VITE_SUPABASE_ANON_KEY = anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  process.env.DOCUMENT_STORAGE_BUCKET = "contract-documents";
  process.env.DATABASE_URL = databaseUrl;

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonymous = createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runId = randomUUID();
  const users = [
    {
      email: `local-rehearsal-a-${runId}@example.invalid`,
      password: `${randomUUID()}-LocalOnly!`,
    },
    {
      email: `local-rehearsal-b-${runId}@example.invalid`,
      password: `${randomUUID()}-LocalOnly!`,
    },
  ];
  const organizations = [
    { id: randomUUID(), name: "Local rehearsal organization A", slug: `local-a-${runId}` },
    { id: randomUUID(), name: "Local rehearsal organization B", slug: `local-b-${runId}` },
  ];
  const createdUserIds = [];
  const storageKeys = [];
  const report = {
    result: "PASS",
    migrations: {},
    auth: {},
    tenancy: {},
    storage: {},
    backendCompatibility: {},
    frontendCompatibility: {},
    ai: {},
    safety: {},
  };

  try {
    const migrationRows = await pool.query(
      "select version from supabase_migrations.schema_migrations order by version"
    );
    const appliedVersions = migrationRows.rows.map((row) => row.version);
    assert.deepEqual(appliedVersions, expectedMigrations);
    report.migrations = { applied: appliedVersions.length, exactOrder: true };

    const bucketResult = await admin.storage.getBucket("contract-documents");
    assert.ifError(bucketResult.error);
    assert.equal(bucketResult.data.public, false);
    report.storage.privateBucket = true;

    const clients = [];
    for (const user of users) {
      const client = createClient(apiUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signup = await client.auth.signUp({
        email: user.email,
        password: user.password,
      });
      assert.ifError(signup.error);
      assert.ok(signup.data.user);
      assert.ok(signup.data.session);
      user.id = signup.data.user.id;
      createdUserIds.push(user.id);
      clients.push(client);
    }
    report.auth.signup = true;

    const firstClient = clients[0];
    const initialLogout = await firstClient.auth.signOut();
    assert.ifError(initialLogout.error);
    const login = await firstClient.auth.signInWithPassword(users[0]);
    assert.ifError(login.error);
    assert.ok(login.data.session?.access_token);
    assert.ok(login.data.session?.refresh_token);
    report.auth.login = true;
    report.auth.session = true;

    const refreshed = await firstClient.auth.refreshSession();
    assert.ifError(refreshed.error);
    assert.ok(refreshed.data.session?.access_token);
    assert.ok(refreshed.data.session?.refresh_token);
    report.auth.refresh = true;

    const reset = await firstClient.auth.resetPasswordForEmail(users[0].email, {
      redirectTo: "http://127.0.0.1:3000/reset-password",
    });
    assert.ifError(reset.error);
    const resetEmail = await waitForResetEmail(mailpitUrl, users[0].email);
    const resetContent = `${resetEmail.Text || ""}\n${resetEmail.HTML || ""}`.replaceAll(
      "&amp;",
      "&"
    );
    assert.match(resetContent, /127\.0\.0\.1:54321\/auth\/v1\/verify/);
    assert.match(resetContent, /127\.0\.0\.1(?::3000)?/);
    report.auth.passwordResetEmail = true;
    report.auth.passwordResetRedirectIsLocal = true;

    const resetLink = resetContent.match(
      /http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^\s"'<>]+/
    )?.[0];
    assert.ok(resetLink, "Password reset verification link is missing");
    const verificationResponse = await fetch(resetLink, { redirect: "manual" });
    assert.ok(
      [302, 303].includes(verificationResponse.status),
      "Password reset verification did not redirect"
    );
    const recoveryRedirect = assertLoopbackUrl(
      verificationResponse.headers.get("location"),
      "password reset redirect"
    );
    assert.equal(recoveryRedirect.port, "3000");
    const recoveryParameters = new URLSearchParams(recoveryRedirect.hash.slice(1));
    const recoveryClient = createClient(apiUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const recoverySession = await recoveryClient.auth.setSession({
      access_token: recoveryParameters.get("access_token"),
      refresh_token: recoveryParameters.get("refresh_token"),
    });
    assert.ifError(recoverySession.error);
    const replacementPassword = `${randomUUID()}-ResetLocalOnly!`;
    const passwordUpdate = await recoveryClient.auth.updateUser({
      password: replacementPassword,
    });
    assert.ifError(passwordUpdate.error);
    const recoveryLogout = await recoveryClient.auth.signOut();
    assert.ifError(recoveryLogout.error);
    users[0].password = replacementPassword;
    report.auth.passwordResetCompleted = true;

    const logout = await firstClient.auth.signOut();
    assert.ifError(logout.error);
    const loggedOutSession = await firstClient.auth.getSession();
    assert.ifError(loggedOutSession.error);
    assert.equal(loggedOutSession.data.session, null);
    report.auth.logout = true;

    const relogin = await firstClient.auth.signInWithPassword(users[0]);
    assert.ifError(relogin.error);

    const insertOrganizations = await admin
      .from("organizations")
      .insert(organizations);
    assert.ifError(insertOrganizations.error);
    const insertMemberships = await admin.from("organization_memberships").insert([
      {
        organization_id: organizations[0].id,
        user_id: users[0].id,
        role: "CUSTOMER_ADMIN",
      },
      {
        organization_id: organizations[1].id,
        user_id: users[1].id,
        role: "CUSTOMER_ADMIN",
      },
    ]);
    assert.ifError(insertMemberships.error);

    const contracts = [
      {
        id: randomUUID(),
        organization_id: organizations[0].id,
        created_by: users[0].id,
        title: "Local tenant A contract",
      },
      {
        id: randomUUID(),
        organization_id: organizations[1].id,
        created_by: users[1].id,
        title: "Local tenant B contract",
      },
    ];
    const insertContracts = await admin.from("contracts").insert(contracts);
    assert.ifError(insertContracts.error);

    for (let index = 0; index < clients.length; index += 1) {
      if (index === 1) {
        const loginSecond = await clients[index].auth.signInWithPassword(users[index]);
        assert.ifError(loginSecond.error);
      }
      const ownMembership = await clients[index].rpc("is_organization_member", {
        target_org: organizations[index].id,
      });
      assert.ifError(ownMembership.error);
      assert.equal(ownMembership.data, true);

      const otherMembership = await clients[index].rpc("is_organization_member", {
        target_org: organizations[1 - index].id,
      });
      assert.ifError(otherMembership.error);
      assert.equal(otherMembership.data, false);

      const visibleContracts = await clients[index]
        .from("contracts")
        .select("id, organization_id");
      assert.ifError(visibleContracts.error);
      assert.deepEqual(visibleContracts.data, [
        {
          id: contracts[index].id,
          organization_id: organizations[index].id,
        },
      ]);
    }
    const anonymousOrganizations = await anonymous.from("organizations").select("id");
    assert.ifError(anonymousOrganizations.error);
    assert.deepEqual(anonymousOrganizations.data, []);
    report.tenancy.membershipFunction = true;
    report.tenancy.authenticatedIsolation = true;
    report.tenancy.unauthenticatedIsolation = true;

    const documentId = randomUUID();
    const versionId = randomUUID();
    const validStorageKey =
      `organizations/${organizations[0].id}/documents/${documentId}/versions/${versionId}/source.pdf`;
    const backendPayload = Buffer.from(`local-supabase-rehearsal-${runId}`);

    const {
      buildDocumentStorageKey,
      downloadDocumentSource,
      removeDocumentSource,
      uploadDocumentSource,
    } = await import("../services/documentStorageService.js");
    assert.equal(
      buildDocumentStorageKey({
        organizationId: organizations[0].id,
        documentId,
        versionId,
        extension: ".pdf",
      }),
      validStorageKey
    );
    assert.throws(
      () =>
        buildDocumentStorageKey({
          organizationId: organizations[0].id,
          documentId,
          versionId,
          extension: ".txt",
        }),
      /extension must be/
    );
    report.storage.backendPathBuilder = true;

    await uploadDocumentSource({
      storageKey: validStorageKey,
      buffer: backendPayload,
      mimeType: "application/pdf",
    });
    storageKeys.push(validStorageKey);
    report.storage.serviceRoleUpload = true;

    const backendDownload = await downloadDocumentSource(validStorageKey);
    assert.deepEqual(backendDownload, backendPayload);
    report.storage.serviceRoleDownload = true;

    const memberDownload = await clients[0].storage
      .from("contract-documents")
      .download(validStorageKey);
    assert.ifError(memberDownload.error);
    assert.deepEqual(
      Buffer.from(await memberDownload.data.arrayBuffer()),
      backendPayload
    );
    report.storage.memberRead = true;

    const crossTenantDownload = await clients[1].storage
      .from("contract-documents")
      .download(validStorageKey);
    assert.ok(crossTenantDownload.error);
    report.storage.crossTenantReadDenied = true;

    const anonymousDownload = await anonymous.storage
      .from("contract-documents")
      .download(validStorageKey);
    assert.ok(anonymousDownload.error);
    report.storage.unauthenticatedReadDenied = true;

    const directUploadKey =
      `organizations/${organizations[0].id}/documents/${randomUUID()}/versions/${randomUUID()}/source.pdf`;
    const authenticatedUpload = await clients[0].storage
      .from("contract-documents")
      .upload(directUploadKey, Buffer.from("must be denied"), {
        contentType: "application/pdf",
      });
    assert.ok(authenticatedUpload.error);
    report.storage.authenticatedUploadDenied = true;

    const authenticatedDelete = await clients[0].storage
      .from("contract-documents")
      .remove([validStorageKey]);
    assert.ifError(authenticatedDelete.error);
    assert.deepEqual(authenticatedDelete.data, []);
    const afterAuthenticatedDelete = await clients[0].storage
      .from("contract-documents")
      .download(validStorageKey);
    assert.ifError(afterAuthenticatedDelete.error);
    assert.deepEqual(
      Buffer.from(await afterAuthenticatedDelete.data.arrayBuffer()),
      backendPayload
    );
    report.storage.authenticatedDeleteDenied = true;

    const invalidStorageKey = `invalid/${randomUUID()}.pdf`;
    const invalidUpload = await admin.storage
      .from("contract-documents")
      .upload(invalidStorageKey, Buffer.from("service role bypass check"), {
        contentType: "application/pdf",
      });
    assert.ifError(invalidUpload.error);
    storageKeys.push(invalidStorageKey);
    const invalidMemberRead = await clients[0].storage
      .from("contract-documents")
      .download(invalidStorageKey);
    assert.ok(invalidMemberRead.error);
    report.storage.memberPathPolicyEnforced = true;
    report.storage.serviceRoleBypassesPathPolicy = true;

    await removeDocumentSource(validStorageKey);
    storageKeys.splice(storageKeys.indexOf(validStorageKey), 1);
    const deletedDownload = await admin.storage
      .from("contract-documents")
      .download(validStorageKey);
    assert.ok(deletedDownload.error);
    report.storage.serviceRoleDelete = true;
    report.backendCompatibility.storageService = true;

    const { adminLogin } = await import("../services/authService.js");
    let loginResponse;
    await adminLogin(
      { body: { email: users[0].email, password: users[0].password } },
      {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          loginResponse = { statusCode: this.statusCode || 200, payload };
          return this;
        },
      }
    );
    assert.equal(loginResponse.statusCode, 200);
    assert.equal(loginResponse.payload.success, true);
    assert.equal(loginResponse.payload.user.id, users[0].id);
    report.backendCompatibility.authService = true;

    const memoryStorage = new Map();
    const frontendLikeClient = createClient(apiUrl, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: {
          getItem: (key) => memoryStorage.get(key) || null,
          setItem: (key, value) => memoryStorage.set(key, value),
          removeItem: (key) => memoryStorage.delete(key),
        },
      },
    });
    const authEvents = [];
    const listener = frontendLikeClient.auth.onAuthStateChange((event) => {
      authEvents.push(event);
    });
    const frontendLogin = await frontendLikeClient.auth.signInWithPassword(users[0]);
    assert.ifError(frontendLogin.error);
    const frontendSession = await frontendLikeClient.auth.getSession();
    assert.ifError(frontendSession.error);
    assert.equal(frontendSession.data.session?.user.id, users[0].id);
    const frontendLogout = await frontendLikeClient.auth.signOut();
    assert.ifError(frontendLogout.error);
    listener.data.subscription.unsubscribe();
    assert.ok(authEvents.includes("SIGNED_IN"));
    assert.ok(authEvents.includes("SIGNED_OUT"));
    report.frontendCompatibility.sessionRestorePattern = true;
    report.frontendCompatibility.authStateChangePattern = true;
    report.frontendCompatibility.logoutPattern = true;

    const budgetCount = await admin
      .from("ai_intelligence_budgets")
      .select("organization_id", { count: "exact", head: true });
    assert.ifError(budgetCount.error);
    assert.equal(budgetCount.count, 0);
    const activeDatabaseUrl = process.env.DATABASE_URL;
    let createPostgresIntelligenceStore;
    try {
      process.env.DATABASE_URL = "";
      ({ createPostgresIntelligenceStore } = await import(
        "../services/ai/postgresIntelligenceStore.js"
      ));
    } finally {
      process.env.DATABASE_URL = activeDatabaseUrl;
    }
    const intelligenceStore = createPostgresIntelligenceStore(pool);
    const reservedBudget = await intelligenceStore.reserveBudget(
      organizations[0].id,
      1
    );
    assert.equal(reservedBudget, null);
    await assert.rejects(
      intelligenceStore.consumeBudget(organizations[0].id, 0, 1),
      (error) => error.code === "INTELLIGENCE_BUDGET_NOT_CONFIGURED"
    );
    report.ai.tableExists = true;
    report.ai.automaticBudgetRows = 0;
    report.ai.processingRequiresBudgetRow = true;

    report.safety.loopbackOnly = true;
    report.safety.contactedOrigins = [...contactedOrigins].sort();
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (storageKeys.length > 0) {
      await admin.storage.from("contract-documents").remove(storageKeys);
    }
    await admin.from("organizations").delete().in(
      "id",
      organizations.map((organization) => organization.id)
    );
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId);
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        result: "FAIL",
        name: error.name,
        message: error.message,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
