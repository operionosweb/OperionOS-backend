export const OCI_PROTECTED_PROJECT_REFS = Object.freeze([
  "cvwalskmgniwtmqqbdvj",
  "amlpybvkzoegnxwuodyn",
]);

function assertNotExistingProject(projectRef) {
  if (OCI_PROTECTED_PROJECT_REFS.includes(projectRef)) {
    throw new Error("An existing Supabase project cannot be used as the dedicated OCI target.");
  }
}

export function assertDedicatedOciDatabaseTarget({ target, projectRef, databaseUrl }) {
  if (target !== "dedicated-oci") throw new Error("OCI provisioning target must equal dedicated-oci.");
  if (!/^[a-z0-9]{20}$/.test(projectRef || "")) {
    throw new Error("OCI project reference must identify the dedicated OCI project.");
  }
  assertNotExistingProject(projectRef);

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("OCI provisioning database URL must be a PostgreSQL connection URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("OCI provisioning database URL must use PostgreSQL.");
  }

  const directHost = url.hostname === `db.${projectRef}.supabase.co`
    && decodeURIComponent(url.username) === "postgres";
  const poolerHost = url.hostname.endsWith(".pooler.supabase.com")
    && decodeURIComponent(url.username) === `postgres.${projectRef}`;
  if ((!directHost && !poolerHost) || !url.pathname || url.pathname === "/") {
    throw new Error("OCI provisioning database destination does not match the dedicated project reference.");
  }

  return url;
}

export function assertDedicatedOciSupabaseUrl({ target, projectRef, supabaseUrl }) {
  if (target !== "dedicated-oci" || !/^[a-z0-9]{20}$/.test(projectRef || "")) {
    throw new Error("OCI Auth target must identify the dedicated OCI project.");
  }
  assertNotExistingProject(projectRef);

  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new Error("OCI Auth URL must identify the dedicated project.");
  }
  if (url.protocol !== "https:" || url.hostname !== `${projectRef}.supabase.co`
    || url.port || url.username || url.password || (url.pathname !== "" && url.pathname !== "/")
    || url.search || url.hash) {
    throw new Error("OCI Auth destination does not match the dedicated project reference.");
  }
  return url;
}
