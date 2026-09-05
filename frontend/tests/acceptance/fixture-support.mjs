import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { TextReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js";
import pg from "pg";

import { acceptanceStatePath, loadAcceptanceEnvironment } from "./environment.mjs";

const BUCKET = process.env.CONTRACT_DOCUMENT_BUCKET || "contract-documents";

export function createClients() {
  loadAcceptanceEnvironment();
  return {
    admin: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    pool: new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
  };
}

export async function apiRequest(route, { token, organizationId, method = "GET", body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (organizationId) headers["x-org-id"] = organizationId;
  if (body && !(body instanceof FormData)) headers["content-type"] = "application/json";
  const response = await fetch(`${process.env.CONTRACT_ACCEPTANCE_API_URL}${route}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { status: response.status, payload };
}

export async function createTenant({ admin, pool, runLabel, suffix }) {
  const user = { email: `${runLabel}-${suffix}@example.invalid`, password: `${randomUUID()}-TestOnly!` };
  const auth = await admin.auth.admin.createUser({ ...user, email_confirm: true });
  if (auth.error) throw auth.error;
  user.id = auth.data.user.id;
  const organizationId = randomUUID();
  await pool.query("insert into organizations (id, name, slug) values ($1, $2, $3)", [organizationId, `Playwright acceptance ${suffix}`, `${runLabel}-${suffix}`]);
  await pool.query("insert into organization_memberships (organization_id, user_id, role) values ($1, $2, 'owner')", [organizationId, user.id]);
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (session.error) throw session.error;
  return { organizationId, user, token: session.data.session.access_token };
}

export async function writeDocx(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const writer = new Uint8ArrayWriter();
  const zip = new ZipWriter(writer);
  const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const paragraphs = content.split("\n").map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("");
  await zip.add("[Content_Types].xml", new TextReader("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>"));
  await zip.add("_rels/.rels", new TextReader("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>"));
  await zip.add("word/document.xml", new TextReader(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`));
  await zip.close();
  await fs.writeFile(filePath, Buffer.from(await writer.getData()));
}

export async function uploadContract({ filePath, tenant, title }) {
  const form = new FormData();
  const mimeType = path.extname(filePath).toLowerCase() === ".docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/pdf";
  form.append("file", new Blob([await fs.readFile(filePath)], { type: mimeType }), path.basename(filePath));
  form.append("title", title);
  const response = await apiRequest("/api/contracts/upload", { token: tenant.token, organizationId: tenant.organizationId, method: "POST", body: form });
  if (response.status !== 201) throw new Error(`Upload failed (${response.status}): ${JSON.stringify(response.payload)}`);
  return { ...response.payload, title };
}

export async function cleanupFixtures({ admin, pool, state, removeState = true }) {
  const organizationIds = (state?.tenants || []).map((tenant) => tenant.organizationId).filter(Boolean);
  if (organizationIds.length) {
    const documents = await pool.query("select storage_key from documents where organization_id = any($1::uuid[])", [organizationIds]);
    for (const { storage_key: storageKey } of documents.rows) {
      if (storageKey) await admin.storage.from(BUCKET).remove([storageKey]);
    }
    await pool.query("delete from aircraft_contract_relationships where organization_id = any($1::uuid[])", [organizationIds]);
    await pool.query("update contracts set source_document_id = null where organization_id = any($1::uuid[])", [organizationIds]);
    await pool.query("delete from contracts where organization_id = any($1::uuid[])", [organizationIds]);
    await pool.query("delete from organizations where id = any($1::uuid[])", [organizationIds]);
  }
  if (state?.aircraftIds?.length) await pool.query("delete from aircraft where id = any($1::uuid[])", [state.aircraftIds]);
  for (const tenant of state?.tenants || []) {
    if (!tenant.user?.id) continue;
    const deletion = await admin.auth.admin.deleteUser(tenant.user.id);
    if (deletion.error && deletion.error.status !== 404) throw deletion.error;
  }
  if (removeState) await fs.rm(path.dirname(acceptanceStatePath), { recursive: true, force: true });
}

export async function cleanupStaleFixtures({ admin, pool }) {
  const organizations = await pool.query("select id from organizations where slug like 'playwright-acceptance-%'");
  if (!organizations.rows.length) return;
  const organizationIds = organizations.rows.map((row) => row.id);
  const users = await pool.query("select distinct user_id from organization_memberships where organization_id = any($1::uuid[])", [organizationIds]);
  const aircraft = await pool.query("select distinct aircraft_id from aircraft_organization_relationships where organization_id = any($1::uuid[])", [organizationIds]);
  await cleanupFixtures({
    admin,
    pool,
    removeState: false,
    state: {
      tenants: organizationIds.map((organizationId) => ({ organizationId })),
      aircraftIds: aircraft.rows.map((row) => row.aircraft_id),
    },
  });
  for (const { user_id: userId } of users.rows) {
    const deletion = await admin.auth.admin.deleteUser(userId);
    if (deletion.error && deletion.error.status !== 404) throw deletion.error;
  }
}

export async function readAcceptanceState({ optional = false } = {}) {
  try {
    return JSON.parse(await fs.readFile(acceptanceStatePath, "utf8"));
  } catch (error) {
    if (optional && error.code === "ENOENT") return null;
    throw error;
  }
}