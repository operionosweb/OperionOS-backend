import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { TextReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js";
import pg from "pg";

import { loadAcceptanceEnvironment } from "./environment.mjs";
import { assertAcceptanceExecutionAllowed } from "./safety.mjs";

export function createClients() {
  assertAcceptanceExecutionAllowed();
  loadAcceptanceEnvironment();
  return {
    admin: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    pool: new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false }),
  };
}

export async function apiRequest(route, { token, organizationId, method = "GET", body } = {}) {
  assertAcceptanceExecutionAllowed();
  loadAcceptanceEnvironment();
  if (!route.startsWith("/api/") || route.includes("\\") || /[\r\n]/.test(route)) {
    throw new Error("Acceptance requests must use an application API path.");
  }
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (organizationId) headers["x-org-id"] = organizationId;
  if (body && !(body instanceof FormData)) headers["content-type"] = "application/json";
  const response = await fetch(`${process.env.CONTRACT_ACCEPTANCE_API_URL}${route}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
    redirect: "error",
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { status: response.status, payload };
}

export async function createTenant({ admin, pool, runLabel, suffix }) {
  assertAcceptanceExecutionAllowed();
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
  assertAcceptanceExecutionAllowed();
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
  assertAcceptanceExecutionAllowed();
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

export async function cleanupFixtures() {
  assertAcceptanceExecutionAllowed();
}

export async function readAcceptanceState() {
  assertAcceptanceExecutionAllowed();
}