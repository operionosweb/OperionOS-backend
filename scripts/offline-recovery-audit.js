import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIRECTORY = path.join(ROOT, "supabase", "migrations");
const DEFAULT_INPUT = path.join(ROOT, "recovery", "source");
const DEFAULT_REPORT_ROOT = path.join(ROOT, "recovery", "reports");
const STORAGE_PATH_PATTERN =
  /^organizations\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/documents\/([0-9a-f-]{36})\/versions\/([0-9a-f-]{36})\/source\.(pdf|docx)$/i;
const SENSITIVE_COLUMN_PATTERN =
  /(password|secret|token|private.?key|service.?role|refresh|recovery|confirmation|nonce|salt|verifier)/i;
const MAX_STORED_ROWS_PER_TABLE = 1_000_000;

const priorityTables = [
  "contract_audit_log",
  "ai_intelligence_budgets",
  "organizations",
  "organization_memberships",
  "contracts",
  "documents",
  "document_versions",
  "clauses",
  "obligations",
  "deadlines",
  "risks",
  "recommendations",
  "intelligence_evidence",
  "clause_evidence",
  "obligation_evidence",
  "deadline_evidence",
  "risk_evidence",
  "recommendation_evidence",
  "party_evidence",
  "analysis_runs",
  "contract_search_chunks",
  "contract_intelligence_profiles",
  "aircraft",
  "aircraft_organization_relationships",
  "aircraft_contract_relationships",
  "audit_events",
];

const explicitRelationships = [
  ["organization_memberships", ["organization_id"], "organizations", ["id"]],
  ["organization_memberships", ["user_id"], "auth.users", ["id"]],
  ["contracts", ["organization_id"], "organizations", ["id"]],
  ["contracts", ["created_by"], "auth.users", ["id"]],
  ["documents", ["organization_id"], "organizations", ["id"]],
  ["documents", ["contract_id"], "contracts", ["id"]],
  ["documents", ["created_by"], "auth.users", ["id"]],
  ["document_versions", ["organization_id"], "organizations", ["id"]],
  ["document_versions", ["document_id"], "documents", ["id"]],
  ["document_versions", ["created_by"], "auth.users", ["id"]],
  ["analysis_runs", ["organization_id"], "organizations", ["id"]],
  ["analysis_runs", ["contract_id"], "contracts", ["id"]],
  ["analysis_runs", ["document_version_id"], "document_versions", ["id"]],
  ["analysis_runs", ["requested_by"], "auth.users", ["id"]],
  ["clauses", ["organization_id"], "organizations", ["id"]],
  ["clauses", ["analysis_run_id"], "analysis_runs", ["id"]],
  ["clauses", ["document_version_id"], "document_versions", ["id"]],
  ["obligations", ["organization_id"], "organizations", ["id"]],
  ["obligations", ["analysis_run_id"], "analysis_runs", ["id"]],
  ["deadlines", ["organization_id"], "organizations", ["id"]],
  ["deadlines", ["analysis_run_id"], "analysis_runs", ["id"]],
  ["risks", ["organization_id"], "organizations", ["id"]],
  ["risks", ["analysis_run_id"], "analysis_runs", ["id"]],
  ["recommendations", ["organization_id"], "organizations", ["id"]],
  ["recommendations", ["analysis_run_id"], "analysis_runs", ["id"]],
  ["intelligence_evidence", ["organization_id"], "organizations", ["id"]],
  ["intelligence_evidence", ["analysis_run_id"], "analysis_runs", ["id"]],
  ["contract_intelligence_profiles", ["organization_id"], "organizations", ["id"]],
  ["contract_intelligence_profiles", ["analysis_run_id"], "analysis_runs", ["id"]],
  ["aircraft_organization_relationships", ["organization_id"], "organizations", ["id"]],
  ["aircraft_organization_relationships", ["aircraft_id"], "aircraft", ["id"]],
  ["aircraft_contract_relationships", ["organization_id"], "organizations", ["id"]],
  ["aircraft_contract_relationships", ["aircraft_id"], "aircraft", ["id"]],
  ["aircraft_contract_relationships", ["contract_id"], "contracts", ["id"]],
  ["ai_intelligence_budgets", ["organization_id"], "organizations", ["id"]],
];

const evidenceRelationships = [
  ["clause_evidence", "clause_id", "clauses"],
  ["obligation_evidence", "obligation_id", "obligations"],
  ["deadline_evidence", "deadline_id", "deadlines"],
  ["risk_evidence", "risk_id", "risks"],
  ["recommendation_evidence", "recommendation_id", "recommendations"],
  ["party_evidence", "party_id", "contract_parties"],
].flatMap(([junction, entityColumn, entityTable]) => [
  [junction, [entityColumn], entityTable, ["id"]],
  [junction, ["evidence_id"], "intelligence_evidence", ["id"]],
]);

const deterministicIdentities = [
  ["contracts", ["id"]],
  ["documents", ["id"]],
  ["document_versions", ["id"]],
  ["organization_memberships", ["organization_id", "user_id"]],
  ["documents", ["organization_id", "sha256"]],
  ["document_versions", ["document_id", "version_number"]],
  ["document_versions", ["organization_id", "sha256"]],
  ["clauses", ["organization_id", "document_version_id", "analysis_run_id", "clause_identity"]],
  ["obligations", ["organization_id", "analysis_run_id", "scope_identity"]],
];

const ownershipColumns = new Map([
  ["organization_memberships", ["organization_id", "user_id"]],
  ["contracts", ["organization_id", "created_by"]],
  ["documents", ["organization_id", "contract_id", "created_by"]],
  ["document_versions", ["organization_id", "document_id", "created_by"]],
  ["analysis_runs", ["organization_id", "contract_id", "document_version_id", "requested_by"]],
  ["clauses", ["organization_id", "analysis_run_id", "document_version_id"]],
  ["obligations", ["organization_id", "analysis_run_id"]],
  ["deadlines", ["organization_id", "analysis_run_id"]],
  ["risks", ["organization_id", "analysis_run_id"]],
  ["recommendations", ["organization_id", "analysis_run_id"]],
  ["intelligence_evidence", ["organization_id", "analysis_run_id"]],
  ["contract_intelligence_profiles", ["organization_id", "analysis_run_id"]],
]);

const notValidChecks = [
  {
    name: "aircraft_contract_source_evidence_fk",
    kind: "foreign_key",
    table: "aircraft_contract_relationships",
    columns: ["source_evidence_id", "organization_id"],
    targetTable: "intelligence_evidence",
    targetColumns: ["id", "organization_id"],
    nullableColumns: ["source_evidence_id"],
  },
  {
    name: "analysis_runs_contract_organization_fk",
    kind: "foreign_key",
    table: "analysis_runs",
    columns: ["contract_id", "organization_id"],
    targetTable: "contracts",
    targetColumns: ["id", "organization_id"],
  },
  {
    name: "analysis_runs_document_version_organization_fk",
    kind: "foreign_key",
    table: "analysis_runs",
    columns: ["document_version_id", "organization_id"],
    targetTable: "document_versions",
    targetColumns: ["id", "organization_id"],
  },
  {
    name: "commercial_opportunities_evidence_check",
    kind: "check",
    table: "commercial_opportunities",
    test: (row) => present(row.signal_id) || present(row.primary_source_id),
  },
  {
    name: "commercial_people_verified_source_check",
    kind: "check",
    table: "commercial_people",
    test: (row) =>
      row.verification_status !== "VERIFIED_FACT" || present(row.verification_source_id),
  },
  {
    name: "commercial_signals_fact_check",
    kind: "check",
    table: "commercial_signals",
    test: (row) => present(row.extracted_fact),
  },
  {
    name: "commercial_signals_title_check",
    kind: "check",
    table: "commercial_signals",
    test: (row) => present(row.title),
  },
  {
    name: "commercial_signals_verified_source_check",
    kind: "check",
    table: "commercial_signals",
    test: (row) => row.verification_status !== "VERIFIED_FACT" || present(row.source_id),
  },
  {
    name: "contracts_source_document_fk",
    kind: "foreign_key",
    table: "contracts",
    columns: ["source_document_id", "organization_id"],
    targetTable: "documents",
    targetColumns: ["id", "organization_id"],
    nullableColumns: ["source_document_id"],
  },
  {
    name: "document_versions_contract_fk",
    kind: "foreign_key",
    table: "document_versions",
    columns: ["contract_id", "organization_id"],
    targetTable: "contracts",
    targetColumns: ["id", "organization_id"],
    nullableColumns: ["contract_id"],
  },
  {
    name: "document_versions_document_organization_fk",
    kind: "foreign_key",
    table: "document_versions",
    columns: ["document_id", "organization_id"],
    targetTable: "documents",
    targetColumns: ["id", "organization_id"],
  },
  {
    name: "documents_contract_organization_fk",
    kind: "foreign_key",
    table: "documents",
    columns: ["contract_id", "organization_id"],
    targetTable: "contracts",
    targetColumns: ["id", "organization_id"],
  },
];

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" || argument === "--output") {
      result[argument.slice(2)] = argv[index + 1];
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      result.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return result;
}

function usage() {
  return [
    "Usage: npm run recovery:audit -- [--input <directory>] [--output <new-directory>]",
    "",
    `Default input: ${path.relative(ROOT, DEFAULT_INPUT)}`,
    "Default output: recovery/reports/audit-<UTC timestamp>",
  ].join("\n");
}

function portableRelative(root, target) {
  return path.relative(root, target).split(path.sep).join("/");
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function readMagic(filePath, length = 512) {
  const handle = await fsp.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function classifyFile(relativePath, magic) {
  const normalized = relativePath.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();
  const extension = path.extname(lower);
  const ascii = magic.toString("ascii");
  if (ascii.startsWith("PGDMP")) return "PostgreSQL dump";
  if (extension === ".sql") return "SQL";
  if (/(^|\/)(auth|users?)[^/]*\.(json|csv)$/.test(lower)) return "Auth export";
  if (/(^|\/)(storage|buckets?|objects?)[^/]*\.(json|csv)$/.test(lower)) {
    return "Storage metadata";
  }
  const storagePath = normalized.match(/organizations\/.+\/source\.(pdf|docx)$/i)?.[0];
  if (storagePath) return "Storage object";
  if (extension === ".json") return "JSON";
  if (extension === ".csv") return "CSV";
  if ([".zip", ".tar", ".tgz", ".gz", ".7z"].includes(extension)) return "ZIP/archive";
  if ([".dump", ".backup", ".bak"].includes(extension)) return "PostgreSQL dump";
  return "unknown";
}

async function inventoryFiles(inputDirectory) {
  const files = [];
  async function visit(directory) {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const stats = await fsp.lstat(absolutePath);
        files.push({
          path: portableRelative(inputDirectory, absolutePath),
          size: stats.size,
          extension: path.extname(entry.name).toLowerCase(),
          sha256: null,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
          type: "unknown",
          note: "Symbolic link was not followed",
        });
      } else if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        const [stats, digest, magic] = await Promise.all([
          fsp.stat(absolutePath),
          hashFile(absolutePath),
          readMagic(absolutePath),
        ]);
        files.push({
          path: portableRelative(inputDirectory, absolutePath),
          absolutePath,
          size: stats.size,
          extension: path.extname(entry.name).toLowerCase(),
          sha256: digest,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
          type: classifyFile(portableRelative(inputDirectory, absolutePath), magic),
        });
      }
    }
  }
  await visit(inputDirectory);
  return files;
}

function createSchemaModel() {
  return {
    tables: new Map(),
    extensions: new Set(),
    functions: new Map(),
    triggers: new Map(),
    indexes: new Map(),
    policies: new Map(),
    rlsTables: new Set(),
  };
}

function ensureTable(model, rawName) {
  const name = cleanQualifiedName(rawName);
  if (!model.tables.has(name)) {
    model.tables.set(name, { columns: new Map(), constraints: new Map() });
  }
  return model.tables.get(name);
}

function cleanIdentifier(value) {
  return value?.trim().replace(/^"|"$/g, "") || "";
}

function cleanQualifiedName(value) {
  const parts = value.trim().replace(/;$/, "").split(".");
  const cleaned = parts.map(cleanIdentifier);
  if (cleaned.length === 1 || cleaned[0] === "public") return cleaned.at(-1);
  return `${cleaned.at(-2)}.${cleaned.at(-1)}`;
}

function normalizeDefinition(value) {
  return value
    .replace(/"/g, "")
    .replace(/\b(public|auth|storage)\./gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeType(value) {
  const normalized = normalizeDefinition(value);
  return new Map([
    ["timestamp with time zone", "timestamptz"],
    ["timestamp without time zone", "timestamp"],
    ["character varying", "varchar"],
    ["int", "integer"],
    ["int4", "integer"],
    ["int8", "bigint"],
    ["bool", "boolean"],
  ]).get(normalized) || normalized;
}

function splitTopLevel(value, separator = ",") {
  const result = [];
  let current = "";
  let depth = 0;
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      current += character;
      if (character === quote && value[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
    } else if (character === "(" || character === "[") {
      depth += 1;
      current += character;
    } else if (character === ")" || character === "]") {
      depth -= 1;
      current += character;
    } else if (character === separator && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parseColumnDefinition(tableName, table, definition) {
  const trimmed = definition.trim();
  if (!trimmed) return;
  if (/^(constraint|primary key|unique|foreign key|check)\b/i.test(trimmed)) {
    const named = trimmed.match(/^constraint\s+("?[\w-]+"?)\s+([\s\S]+)$/i);
    const body = named?.[2] || trimmed;
    const columns = body
      .match(/(?:primary\s+key|unique|foreign\s+key)\s*\(([^)]+)\)/i)?.[1]
      ?.split(",")
      .map((column) => cleanIdentifier(column))
      .join("_");
    let generatedName = `${tableName}_${sha256(normalizeDefinition(body)).slice(0, 12)}`;
    if (/^primary\s+key\b/i.test(body)) generatedName = `${tableName}_pkey`;
    else if (/^unique\b/i.test(body) && columns) generatedName = `${tableName}_${columns}_key`;
    else if (/^foreign\s+key\b/i.test(body) && columns) {
      generatedName = `${tableName}_${columns.split("_")[0]}_fkey`;
    }
    table.constraints.set(
      named ? cleanIdentifier(named[1]) : generatedName,
      normalizeDefinition(body)
    );
    return;
  }
  const match = trimmed.match(/^("?[\w-]+"?)\s+([\s\S]+)$/);
  if (!match) return;
  const name = cleanIdentifier(match[1]);
  const remainder = match[2];
  const typeMatch = remainder.match(
    /^(.+?)(?=\s+(?:default|not\s+null|null|constraint|primary\s+key|references|check|unique|generated|collate)\b|$)/i
  );
  const type = normalizeType(typeMatch?.[1] || remainder);
  table.columns.set(name, {
    type,
    notNull: /\bnot\s+null\b/i.test(remainder) || /\bprimary\s+key\b/i.test(remainder),
  });
  if (/\bprimary\s+key\b/i.test(remainder)) {
    table.constraints.set(`${tableName}_pkey`, `primary key (${name})`);
  }
  if (/\bunique\b/i.test(remainder)) {
    table.constraints.set(`${tableName}_${name}_key`, `unique (${name})`);
  }
  const references = remainder.match(
    /\breferences\s+((?:"?[\w-]+"?\.)?"?[\w-]+"?)\s*\(([^)]+)\)([\s\S]*)/i
  );
  if (references) {
    table.constraints.set(
      `${tableName}_${name}_fkey`,
      normalizeDefinition(
        `foreign key (${name}) references ${references[1]} (${references[2]}) ${references[3]}`
      )
    );
  }
  const check = remainder.match(/\bcheck\s*\(([\s\S]+)\)\s*(?:,|$)/i);
  if (check) {
    table.constraints.set(
      `${tableName}_${name}_check`,
      normalizeDefinition(`check (${check[1]})`)
    );
  }
}

function applySqlStatement(model, rawStatement) {
  const statement = rawStatement
    .replace(/--.*$/gm, "")
    .replace(/^\s+|\s+$/g, "");
  if (!statement) return;

  const tableLoop = statement.match(
    /foreach\s+\w+\s+in\s+array\s+array\s*\[([\s\S]+?)\]\s+loop/i
  );
  if (tableLoop) {
    const tables = [...tableLoop[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
    for (const table of tables) {
      if (/create\s+trigger\s+prevent_phase3_update/i.test(statement)) {
        model.triggers.set(`${table}.prevent_phase3_update`, {
          table,
          definitionHash: sha256(
            normalizeDefinition(
              "create trigger prevent_phase3_update before update execute prevent_phase3_result_update"
            )
          ),
          comparisonLimited: true,
        });
      }
      if (/create\s+policy\s+phase3_member_select/i.test(statement)) {
        model.policies.set(`${table}.phase3_member_select`, {
          table,
          definitionHash: sha256(
            normalizeDefinition(
              "create policy phase3_member_select for select using is_organization_member organization_id"
            )
          ),
          comparisonLimited: true,
        });
      }
      if (/enable\s+row\s+level\s+security/i.test(statement)) {
        model.rlsTables.add(table);
      }
    }
    return;
  }

  let match = statement.match(/create\s+extension\s+(?:if\s+not\s+exists\s+)?("?[\w-]+"?)/i);
  if (match) {
    model.extensions.add(cleanIdentifier(match[1]));
    return;
  }

  match = statement.match(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"?[\w-]+"?\.)?"?[\w-]+"?)\s*\(([\s\S]*)\)\s*;?$/i
  );
  if (match) {
    const tableName = cleanQualifiedName(match[1]);
    const table = ensureTable(model, match[1]);
    for (const definition of splitTopLevel(match[2])) {
      parseColumnDefinition(tableName, table, definition);
    }
    return;
  }

  match = statement.match(
    /alter\s+table\s+(?:only\s+)?((?:"?[\w-]+"?\.)?"?[\w-]+"?)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([\s\S]+?);?$/i
  );
  if (match) {
    const tableName = cleanQualifiedName(match[1]);
    parseColumnDefinition(tableName, ensureTable(model, match[1]), match[2]);
    return;
  }

  match = statement.match(
    /alter\s+table\s+(?:only\s+)?((?:"?[\w-]+"?\.)?"?[\w-]+"?)\s+drop\s+constraint\s+(?:if\s+exists\s+)?("?[\w-]+"?)/i
  );
  if (match) {
    ensureTable(model, match[1]).constraints.delete(cleanIdentifier(match[2]));
    return;
  }

  match = statement.match(
    /alter\s+table\s+(?:only\s+)?((?:"?[\w-]+"?\.)?"?[\w-]+"?)\s+add\s+constraint\s+("?[\w-]+"?)\s+([\s\S]+?);?$/i
  );
  if (match) {
    ensureTable(model, match[1]).constraints.set(
      cleanIdentifier(match[2]),
      normalizeDefinition(match[3])
    );
    return;
  }

  match = statement.match(
    /alter\s+table\s+(?:only\s+)?((?:"?[\w-]+"?\.)?"?[\w-]+"?)\s+enable\s+row\s+level\s+security/i
  );
  if (match) {
    model.rlsTables.add(cleanQualifiedName(match[1]));
    return;
  }

  match = statement.match(
    /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?("?[\w-]+"?)\s+on\s+((?:"?[\w-]+"?\.)?"?[\w-]+"?)/i
  );
  if (match) {
    model.indexes.set(cleanIdentifier(match[1]), {
      table: cleanQualifiedName(match[2]),
      definitionHash: sha256(normalizeDefinition(statement)),
    });
    return;
  }

  match = statement.match(/drop\s+index\s+(?:if\s+exists\s+)?(?:\w+\.)?("?[\w-]+"?)/i);
  if (match) {
    model.indexes.delete(cleanIdentifier(match[1]));
    return;
  }

  match = statement.match(
    /create\s+(?:or\s+replace\s+)?function\s+((?:"?[\w-]+"?\.)?"?[\w-]+"?)\s*\(/i
  );
  if (match) {
    model.functions.set(cleanQualifiedName(match[1]), {
      definitionHash: sha256(normalizeDefinition(statement)),
    });
    return;
  }

  match = statement.match(
    /create\s+trigger\s+("?[\w-]+"?)[\s\S]+?\bon\s+((?:"?[\w-]+"?\.)?"?[\w-]+"?)/i
  );
  if (match) {
    const table = cleanQualifiedName(match[2]);
    const name = cleanIdentifier(match[1]);
    model.triggers.set(`${table}.${name}`, {
      table,
      definitionHash: sha256(normalizeDefinition(statement)),
    });
    return;
  }

  match = statement.match(
    /drop\s+trigger\s+(?:if\s+exists\s+)?("?[\w-]+"?)\s+on\s+((?:"?[\w-]+"?\.)?"?[\w-]+"?)/i
  );
  if (match) {
    model.triggers.delete(
      `${cleanQualifiedName(match[2])}.${cleanIdentifier(match[1])}`
    );
    return;
  }

  match = statement.match(
    /create\s+policy\s+("?[\w-]+"?)\s+on\s+((?:"?[\w-]+"?\.)?"?[\w-]+"?)/i
  );
  if (match) {
    model.policies.set(`${cleanQualifiedName(match[2])}.${cleanIdentifier(match[1])}`, {
      table: cleanQualifiedName(match[2]),
      definitionHash: sha256(normalizeDefinition(statement)),
    });
    return;
  }

  match = statement.match(
    /drop\s+policy\s+(?:if\s+exists\s+)?("?[\w-]+"?)\s+on\s+((?:"?[\w-]+"?\.)?"?[\w-]+"?)/i
  );
  if (match) {
    model.policies.delete(`${cleanQualifiedName(match[2])}.${cleanIdentifier(match[1])}`);
  }
}

async function canonicalSchemaModel() {
  const model = createSchemaModel();
  const files = (await fsp.readdir(MIGRATIONS_DIRECTORY))
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .sort();
  if (files.length !== 21) {
    throw new Error(`Expected 21 canonical migrations, found ${files.length}`);
  }
  for (const file of files) {
    const sql = await fsp.readFile(path.join(MIGRATIONS_DIRECTORY, file), "utf8");
    for (const statement of splitSqlStatements(sql)) applySqlStatement(model, statement);
  }
  return { model, files };
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let dollarTag = null;
  let quote = null;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (dollarTag) {
      current += character;
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag.slice(1);
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote && sql[index - 1] !== "\\") quote = null;
      continue;
    }
    const dollar = sql.slice(index).match(/^\$[A-Za-z0-9_]*\$/)?.[0];
    if (dollar) {
      dollarTag = dollar;
      current += dollar;
      index += dollar.length - 1;
    } else if (character === "'" || character === '"') {
      quote = character;
      current += character;
    } else if (character === ";") {
      statements.push(`${current};`);
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) statements.push(current);
  return statements;
}

function createDataStore() {
  return {
    tables: new Map(),
    rowCounts: new Map(),
    observedTables: new Set(),
    truncatedTables: new Set(),
    warnings: [],
  };
}

function normalizeTableName(value) {
  return cleanQualifiedName(value);
}

function present(value) {
  return value !== null && value !== undefined && value !== "";
}

function decodeCopyValue(value) {
  if (value === "\\N") return null;
  return value
    .replace(/\\t/g, "\t")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\");
}

function sanitizeRow(tableName, row) {
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    if (!SENSITIVE_COLUMN_PATTERN.test(key)) result[key] = value;
  }
  if (tableName === "auth.users") {
    return Object.fromEntries(
      Object.entries(result).filter(([key]) =>
        [
          "id",
          "email",
          "created_at",
          "updated_at",
          "raw_app_meta_data",
          "raw_user_meta_data",
          "provider",
          "providers",
          "identities",
        ].includes(key)
      )
    );
  }
  return result;
}

function addDataRow(data, tableName, row) {
  const normalizedTable = normalizeTableName(tableName);
  data.rowCounts.set(normalizedTable, (data.rowCounts.get(normalizedTable) || 0) + 1);
  if (!data.tables.has(normalizedTable)) data.tables.set(normalizedTable, []);
  const rows = data.tables.get(normalizedTable);
  if (rows.length < MAX_STORED_ROWS_PER_TABLE) {
    rows.push(sanitizeRow(normalizedTable, row));
  } else {
    data.truncatedTables.add(normalizedTable);
  }
}

async function inspectPlainSql(file, sourceModel, data) {
  const stream = fs.createReadStream(file.absolutePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let copy = null;
  let statement = "";
  let dollarTag = null;
  for await (const line of lines) {
    if (copy) {
      if (line === "\\.") {
        copy = null;
      } else {
        const values = line.split("\t").map(decodeCopyValue);
        addDataRow(
          data,
          copy.table,
          Object.fromEntries(copy.columns.map((column, index) => [column, values[index] ?? null]))
        );
      }
      continue;
    }
    const copyMatch = line.match(
      /^COPY\s+((?:"?[\w-]+"?\.)?"?[\w-]+"?)\s*\(([^)]+)\)\s+FROM\s+stdin;$/i
    );
    if (copyMatch) {
      copy = {
        table: normalizeTableName(copyMatch[1]),
        columns: splitTopLevel(copyMatch[2]).map(cleanIdentifier),
      };
      data.observedTables.add(copy.table);
      ensureTable(sourceModel, copyMatch[1]);
      continue;
    }
    statement += `${line}\n`;
    if (!dollarTag) {
      const tags = [...line.matchAll(/\$[A-Za-z0-9_]*\$/g)].map((match) => match[0]);
      if (tags.length % 2 === 1) dollarTag = tags.at(-1);
    } else if (line.includes(dollarTag)) {
      dollarTag = null;
    }
    if (!dollarTag && line.trimEnd().endsWith(";")) {
      if (/^\s*insert\s+into\b/i.test(statement)) {
        const warning =
          `${file.path}: INSERT data was detected but row-level inspection currently supports COPY data`;
        if (!data.warnings.includes(warning)) data.warnings.push(warning);
      }
      applySqlStatement(sourceModel, statement);
      statement = "";
    }
  }
  if (copy) data.warnings.push(`${file.path}: unterminated COPY block`);
  if (statement.trim()) applySqlStatement(sourceModel, statement);
}

function pgRestoreAvailable() {
  const result = spawnSync("pg_restore", ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0;
}

function inspectCustomDump(file, sourceModel, data, available) {
  if (!available) {
    data.warnings.push(
      `${file.path}: pg_restore is unavailable; custom dump contents were not restored or inspected`
    );
    return { file: file.path, inspected: false, reason: "pg_restore unavailable" };
  }
  const result = spawnSync("pg_restore", ["--list", file.absolutePath], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    data.warnings.push(`${file.path}: pg_restore could not list this archive`);
    return { file: file.path, inspected: false, reason: "pg_restore list failed" };
  }
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/;\s+\d+\s+\d+\s+(.+?)\s+(\S+)\s+(\S+)(?:\s+\S+)?$/);
    if (!match) continue;
    const kind = match[1].trim().toUpperCase();
    const schema = match[2];
    const name = match[3];
    const qualified = schema === "-" ? name : `${schema}.${name}`;
    if (kind === "TABLE") ensureTable(sourceModel, qualified);
    else if (kind === "EXTENSION") sourceModel.extensions.add(name);
    else if (kind.includes("FUNCTION")) {
      sourceModel.functions.set(cleanQualifiedName(qualified), {
        definitionHash: null,
        catalogOnly: true,
      });
    } else if (kind.includes("TRIGGER")) {
      sourceModel.triggers.set(name, {
        table: null,
        definitionHash: null,
        catalogOnly: true,
      });
    } else if (kind.includes("INDEX")) {
      sourceModel.indexes.set(name, {
        table: null,
        definitionHash: null,
        catalogOnly: true,
      });
    }
    else if (kind.includes("CONSTRAINT")) {
      ensureTable(sourceModel, qualified).constraints.set(name, kind);
    } else if (kind.includes("POLICY")) {
      sourceModel.policies.set(`${cleanQualifiedName(qualified)}.${name}`, {
        table: cleanQualifiedName(qualified),
        definitionHash: null,
        catalogOnly: true,
      });
    }
  }
  return {
    file: file.path,
    inspected: true,
    reason: "TOC inspected without restoration; row counts and column types unavailable",
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function inferredTableName(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/(?:_export|_backup|_data)$/i, "")
    .toLowerCase();
}

function looksLikeAuthRows(rows, filePath) {
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  return (
    /(?:auth|users?)/i.test(path.basename(filePath)) &&
    keys.has("id") &&
    (keys.has("email") || keys.has("encrypted_password") || keys.has("identities"))
  );
}

function looksLikeStorageRows(rows, filePath) {
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  return (
    /(?:storage|objects?|buckets?)/i.test(path.basename(filePath)) &&
    (keys.has("bucket_id") || keys.has("name"))
  );
}

async function inspectStructuredFile(file, data, structured) {
  if (file.size > 512 * 1024 * 1024) {
    data.warnings.push(`${file.path}: structured file exceeds 512 MiB inspection limit`);
    return;
  }
  const text = await fsp.readFile(file.absolutePath, "utf8");
  let rows = [];
  let declaredTable = inferredTableName(file.path);
  if (file.extension === ".csv") {
    const parsed = parseCsv(text);
    const headers = parsed.shift()?.map((header) => header.trim()) || [];
    rows = parsed
      .filter((values) => values.some((value) => value !== ""))
      .map((values) =>
        Object.fromEntries(headers.map((header, index) => [header, values[index] || null]))
      );
  } else {
    try {
      const value = JSON.parse(text);
      if (Array.isArray(value)) rows = value;
      else if (Array.isArray(value.users)) {
        rows = value.users;
        declaredTable = "auth.users";
      } else if (Array.isArray(value.objects)) {
        rows = value.objects;
        declaredTable = "storage.objects";
      } else if (Array.isArray(value.rows)) {
        rows = value.rows;
        declaredTable = value.table || declaredTable;
      }
    } catch {
      data.warnings.push(`${file.path}: invalid JSON`);
      return;
    }
  }
  rows = rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  if (looksLikeAuthRows(rows, file.path)) declaredTable = "auth.users";
  if (looksLikeStorageRows(rows, file.path)) {
    declaredTable = /bucket/i.test(path.basename(file.path)) ? "storage.buckets" : "storage.objects";
  }
  data.observedTables.add(normalizeTableName(declaredTable));
  for (const row of rows) addDataRow(data, declaredTable, row);
  structured.push({
    file: file.path,
    inferredTable: declaredTable,
    rows: rows.length,
    columns: [...new Set(rows.flatMap((row) => Object.keys(row)))].sort(),
  });
}

function listArchive(file) {
  const result = spawnSync("tar", ["-tf", file.absolutePath], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    return { file: file.path, inspected: false, entries: [], reason: "archive listing unavailable" };
  }
  const entries = result.stdout.split(/\r?\n/).filter(Boolean);
  return {
    file: file.path,
    inspected: true,
    entryCount: entries.length,
    entries: entries.slice(0, 10_000),
    truncated: entries.length > 10_000,
  };
}

function serializeSchemaModel(model) {
  return {
    tables: Object.fromEntries(
      [...model.tables.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, table]) => [
          name,
          {
            columns: Object.fromEntries([...table.columns.entries()].sort()),
            constraints: Object.fromEntries([...table.constraints.entries()].sort()),
          },
        ])
    ),
    extensions: [...model.extensions].sort(),
    functions: Object.fromEntries([...model.functions.entries()].sort()),
    triggers: Object.fromEntries([...model.triggers.entries()].sort()),
    indexes: Object.fromEntries([...model.indexes.entries()].sort()),
    policies: Object.fromEntries([...model.policies.entries()].sort()),
    rlsTables: [...model.rlsTables].sort(),
  };
}

function compareNamedMaps(source, canonical, label) {
  const sourceNames = new Set(source.keys());
  const canonicalNames = new Set(canonical.keys());
  const changed = [...sourceNames]
    .filter((name) => canonicalNames.has(name))
    .filter((name) => {
      const sourceValue = source.get(name);
      const canonicalValue = canonical.get(name);
      if (
        sourceValue?.catalogOnly ||
        sourceValue?.definitionHash === null ||
        canonicalValue?.comparisonLimited
      ) {
        return false;
      }
      return JSON.stringify(sourceValue) !== JSON.stringify(canonicalValue);
    })
    .sort();
  return {
    [`missing${label}`]: [...canonicalNames].filter((name) => !sourceNames.has(name)).sort(),
    [`extra${label}`]: [...sourceNames].filter((name) => !canonicalNames.has(name)).sort(),
    [`changed${label}`]: changed,
  };
}

function compareSchemas(source, canonical) {
  const sourceTables = new Set(source.tables.keys());
  const canonicalTables = new Set(canonical.tables.keys());
  const missingTables = [...canonicalTables].filter((name) => !sourceTables.has(name)).sort();
  const extraTables = [...sourceTables].filter((name) => !canonicalTables.has(name)).sort();
  const columnDifferences = [];
  const typeDifferences = [];
  const nullabilityDifferences = [];
  const constraintDifferences = [];
  for (const tableName of [...sourceTables].filter((name) => canonicalTables.has(name)).sort()) {
    const sourceTable = source.tables.get(tableName);
    const canonicalTable = canonical.tables.get(tableName);
    const sourceColumns = new Set(sourceTable.columns.keys());
    const canonicalColumns = new Set(canonicalTable.columns.keys());
    const missingColumns = [...canonicalColumns].filter((name) => !sourceColumns.has(name)).sort();
    const extraColumns = [...sourceColumns].filter((name) => !canonicalColumns.has(name)).sort();
    if (missingColumns.length || extraColumns.length) {
      columnDifferences.push({ table: tableName, missingColumns, extraColumns });
    }
    for (const column of [...sourceColumns].filter((name) => canonicalColumns.has(name))) {
      const sourceType = sourceTable.columns.get(column).type;
      const canonicalType = canonicalTable.columns.get(column).type;
      if (sourceType !== canonicalType) {
        typeDifferences.push({ table: tableName, column, sourceType, canonicalType });
      }
      const sourceNotNull = sourceTable.columns.get(column).notNull;
      const canonicalNotNull = canonicalTable.columns.get(column).notNull;
      if (sourceNotNull !== canonicalNotNull) {
        nullabilityDifferences.push({
          table: tableName,
          column,
          sourceNotNull,
          canonicalNotNull,
        });
      }
    }
    const sourceConstraints = new Set(sourceTable.constraints.keys());
    const canonicalConstraints = new Set(canonicalTable.constraints.keys());
    const missingConstraints = [...canonicalConstraints]
      .filter((name) => !sourceConstraints.has(name))
      .sort();
    const extraConstraints = [...sourceConstraints]
      .filter((name) => !canonicalConstraints.has(name))
      .sort();
    if (missingConstraints.length || extraConstraints.length) {
      constraintDifferences.push({ table: tableName, missingConstraints, extraConstraints });
    }
  }
  const sourceRls = source.rlsTables;
  const canonicalRls = canonical.rlsTables;
  return {
    sourceTablesNotInCanonical: extraTables,
    canonicalTablesAbsentFromSource: missingTables,
    columnDifferences,
    typeDifferences,
    nullabilityDifferences,
    constraintDifferences,
    ...compareNamedMaps(source.indexes, canonical.indexes, "Indexes"),
    ...compareNamedMaps(source.functions, canonical.functions, "Functions"),
    ...compareNamedMaps(source.triggers, canonical.triggers, "Triggers"),
    ...compareNamedMaps(source.policies, canonical.policies, "Policies"),
    missingRlsTables: [...canonicalRls].filter((name) => !sourceRls.has(name)).sort(),
    extraRlsTables: [...sourceRls].filter((name) => !canonicalRls.has(name)).sort(),
    missingExtensions: [...canonical.extensions]
      .filter((name) => !source.extensions.has(name))
      .sort(),
    extraExtensions: [...source.extensions]
      .filter((name) => !canonical.extensions.has(name))
      .sort(),
    priorityTables: Object.fromEntries(
      priorityTables.map((table) => [
        table,
        {
          source: sourceTables.has(table),
          canonical: canonicalTables.has(table),
        },
      ])
    ),
  };
}

function tableRows(data, table) {
  return data.tables.get(table) || [];
}

function rowFingerprint(table, row) {
  return sha256(`${table}:${row.id || JSON.stringify(row)}`).slice(0, 16);
}

function compositeKey(row, columns) {
  return columns.map((column) => row[column] ?? "<NULL>").join("\u001f");
}

function relationshipCheck(data, relationship) {
  const [table, columns, targetTable, targetColumns] = relationship;
  if (!data.tables.has(table) || !data.tables.has(targetTable)) {
    return {
      name: `${table}(${columns.join(",")}) -> ${targetTable}(${targetColumns.join(",")})`,
      status: "NOT TESTED",
      violations: null,
      reason: "Required table data is absent or not inspectable",
    };
  }
  const targetKeys = new Set(
    tableRows(data, targetTable).map((row) => compositeKey(row, targetColumns))
  );
  const invalid = tableRows(data, table).filter((row) => {
    if (columns.some((column) => !present(row[column]))) return false;
    return !targetKeys.has(compositeKey(row, columns));
  });
  return {
    name: `${table}(${columns.join(",")}) -> ${targetTable}(${targetColumns.join(",")})`,
    status: invalid.length === 0 ? "PASS" : "FAIL",
    violations: invalid.length,
    rowFingerprints: invalid.slice(0, 20).map((row) => rowFingerprint(table, row)),
  };
}

function duplicateCheck(data, [table, columns]) {
  if (!data.tables.has(table)) {
    return {
      name: `${table} unique (${columns.join(",")})`,
      status: "NOT TESTED",
      violations: null,
      reason: "Table data is absent or not inspectable",
    };
  }
  const seen = new Set();
  let duplicates = 0;
  for (const row of tableRows(data, table)) {
    if (columns.some((column) => !present(row[column]))) continue;
    const key = compositeKey(row, columns);
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }
  return {
    name: `${table} unique (${columns.join(",")})`,
    status: duplicates === 0 ? "PASS" : "FAIL",
    violations: duplicates,
  };
}

function ownershipCheck(data, table, columns) {
  if (!data.tables.has(table)) {
    return { table, status: "NOT TESTED", violations: null, reason: "Table data is absent" };
  }
  const invalid = tableRows(data, table).filter((row) =>
    columns.some((column) => !present(row[column]))
  );
  return {
    table,
    columns,
    status: invalid.length === 0 ? "PASS" : "FAIL",
    violations: invalid.length,
    rowFingerprints: invalid.slice(0, 20).map((row) => rowFingerprint(table, row)),
  };
}

function invalidDateChecks(data) {
  const results = [];
  for (const [table, rows] of data.tables) {
    const dateColumns = new Set(
      rows.flatMap((row) =>
        Object.keys(row).filter((column) => /(?:_at|_date|_start|_end)$/.test(column))
      )
    );
    for (const column of dateColumns) {
      const violations = rows.filter(
        (row) => present(row[column]) && Number.isNaN(Date.parse(row[column]))
      ).length;
      results.push({
        table,
        column,
        status: violations === 0 ? "PASS" : "FAIL",
        violations,
      });
    }
  }
  return results;
}

function organizationMembershipChecks(data) {
  if (!data.tables.has("organization_memberships")) {
    return {
      status: "NOT TESTED",
      violations: null,
      reason: "Organization membership data is absent or not inspectable",
    };
  }
  const allowedRoles = new Set([
    "CUSTOMER_ADMIN",
    "CUSTOMER_USER",
    "member",
    "manager",
    "admin",
    "owner",
    "VIEWER",
    "ANALYST",
    "CONTRACT_MANAGER",
    "ORG_ADMIN",
  ]);
  const allowedStatuses = new Set(["active", "invited", "suspended", "removed"]);
  const invalid = tableRows(data, "organization_memberships").filter(
    (row) =>
      !present(row.organization_id) ||
      !present(row.user_id) ||
      !allowedRoles.has(row.role) ||
      !allowedStatuses.has(row.status || "active")
  );
  return {
    status: invalid.length === 0 ? "PASS" : "FAIL",
    violations: invalid.length,
    rowFingerprints: invalid
      .slice(0, 20)
      .map((row) => rowFingerprint("organization_memberships", row)),
  };
}

function futureNotNullChecks(data, canonical) {
  const results = [];
  for (const [tableName, table] of canonical.tables) {
    if (!data.tables.has(tableName)) continue;
    for (const [column, definition] of table.columns) {
      if (!definition.notNull) continue;
      const violations = tableRows(data, tableName).filter((row) => !present(row[column])).length;
      results.push({
        table: tableName,
        column,
        status: violations === 0 ? "PASS" : "FAIL",
        violations,
      });
    }
  }
  return results;
}

function checkNotValidConstraints(data) {
  return notValidChecks.map((check) => {
    if (!data.tables.has(check.table)) {
      return {
        constraint: check.name,
        table: check.table,
        status: "NOT TESTED",
        violations: null,
        reason: "Source table data is absent or not inspectable",
      };
    }
    let invalid;
    if (check.kind === "check") {
      invalid = tableRows(data, check.table).filter((row) => !check.test(row));
    } else if (!data.tables.has(check.targetTable)) {
      return {
        constraint: check.name,
        table: check.table,
        status: "NOT TESTED",
        violations: null,
        reason: "Referenced table data is absent or not inspectable",
      };
    } else {
      const targetKeys = new Set(
        tableRows(data, check.targetTable).map((row) =>
          compositeKey(row, check.targetColumns)
        )
      );
      invalid = tableRows(data, check.table).filter((row) => {
        if (check.nullableColumns?.some((column) => !present(row[column]))) return false;
        if (check.columns.some((column) => !present(row[column]))) return true;
        return !targetKeys.has(compositeKey(row, check.columns));
      });
    }
    return {
      constraint: check.name,
      table: check.table,
      status: invalid.length === 0 ? "PASS" : "FAIL",
      violations: invalid.length,
      rowFingerprints: invalid.slice(0, 20).map((row) => rowFingerprint(check.table, row)),
    };
  });
}

function maskEmail(email) {
  if (!present(email) || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

function parseJsonValue(value) {
  if (!present(value)) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function authReport(data) {
  const users = tableRows(data, "auth.users");
  const providerCounts = {};
  const metadataKeys = new Set();
  const summaries = users.slice(0, 1000).map((user) => {
    const appMetadata = parseJsonValue(user.raw_app_meta_data);
    const userMetadata = parseJsonValue(user.raw_user_meta_data);
    for (const key of [...Object.keys(appMetadata), ...Object.keys(userMetadata)]) {
      if (!SENSITIVE_COLUMN_PATTERN.test(key)) metadataKeys.add(key);
    }
    const providers = [
      ...(Array.isArray(appMetadata.providers) ? appMetadata.providers : []),
      ...(Array.isArray(user.identities)
        ? user.identities.map((identity) => identity?.provider)
        : []),
      appMetadata.provider,
      user.provider,
    ].filter(Boolean);
    for (const provider of new Set(providers)) {
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    }
    return {
      userFingerprint: sha256(String(user.id || "")).slice(0, 16),
      email: maskEmail(user.email),
      providers: [...new Set(providers)].sort(),
      createdAt: user.created_at || null,
      metadataKeys: [
        ...new Set(
          [...Object.keys(appMetadata), ...Object.keys(userMetadata)].filter(
            (key) => !SENSITIVE_COLUMN_PATTERN.test(key)
          )
        ),
      ].sort(),
    };
  });
  const membershipUsers = new Set(
    tableRows(data, "organization_memberships")
      .map((row) => row.user_id)
      .filter(present)
  );
  const authIds = new Set(users.map((row) => row.id).filter(present));
  const unmatchedMembershipUsers = [...membershipUsers].filter((id) => !authIds.has(id));
  return {
    userCount: data.rowCounts.get("auth.users") || 0,
    inspectedUserCount: users.length,
    truncated: data.truncatedTables.has("auth.users"),
    providerCounts,
    metadataKeys: [...metadataKeys].sort(),
    users: summaries,
    organizationMembershipUserCount: membershipUsers.size,
    membershipsWithoutAuthUser: unmatchedMembershipUsers.length,
    unmatchedUserFingerprints: unmatchedMembershipUsers
      .slice(0, 20)
      .map((id) => sha256(String(id)).slice(0, 16)),
    sensitiveValuesExcluded: true,
  };
}

function storageReport(manifest, data) {
  const metadataRows = tableRows(data, "storage.objects");
  const metadata = metadataRows.map((row) => ({
    bucket: row.bucket_id || null,
    path: row.name || null,
    size:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.size || null
        : parseJsonValue(row.metadata).size || null,
    mimeType:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata.mimetype || null
        : parseJsonValue(row.metadata).mimetype || null,
    canonicalPath: STORAGE_PATH_PATTERN.test(row.name || ""),
  }));
  const objects = manifest.files
    .map((file) => {
      const objectPath = file.path.match(/organizations\/.+\/source\.(?:pdf|docx)$/i)?.[0];
      if (!objectPath) return null;
      return {
        path: objectPath,
        size: file.size,
        sha256: file.sha256,
        canonicalPath: STORAGE_PATH_PATTERN.test(objectPath),
      };
    })
    .filter(Boolean);
  const metadataPaths = new Set(metadata.map((row) => row.path).filter(Boolean));
  const objectPaths = new Set(objects.map((row) => row.path));
  const buckets = new Set([
    ...tableRows(data, "storage.buckets").map((row) => row.name || row.id),
    ...metadata.map((row) => row.bucket),
  ].filter(Boolean));
  return {
    buckets: [...buckets].sort(),
    metadataCount: metadata.length,
    objectFileCount: objects.length,
    canonicalMetadataPaths: metadata.filter((row) => row.canonicalPath).length,
    canonicalObjectPaths: objects.filter((row) => row.canonicalPath).length,
    metadataWithoutObject: [...metadataPaths].filter((value) => !objectPaths.has(value)).sort(),
    objectsWithoutMetadata: [...objectPaths].filter((value) => !metadataPaths.has(value)).sort(),
    metadata,
    objects,
  };
}

function integrityReport(data, canonical, storage) {
  const relationships = [...explicitRelationships, ...evidenceRelationships].map((relationship) =>
    relationshipCheck(data, relationship)
  );
  const duplicates = deterministicIdentities.map((identity) => duplicateCheck(data, identity));
  const ownership = [...ownershipColumns].map(([table, columns]) =>
    ownershipCheck(data, table, columns)
  );
  const invalidDates = invalidDateChecks(data);
  const futureNotNull = futureNotNullChecks(data, canonical);
  const organizationMemberships = organizationMembershipChecks(data);
  const storageCoverage =
    storage.metadataCount > 0 || storage.objectFileCount > 0
      ? {
          status:
            storage.metadataWithoutObject.length === 0 &&
            storage.objectsWithoutMetadata.length === 0
              ? "PASS"
              : "FAIL",
          metadataWithoutObject: storage.metadataWithoutObject.length,
          objectsWithoutMetadata: storage.objectsWithoutMetadata.length,
        }
      : {
          status: "NOT TESTED",
          metadataWithoutObject: null,
          objectsWithoutMetadata: null,
        };
  const groups = [
    relationships,
    duplicates,
    ownership,
    invalidDates,
    futureNotNull,
    [organizationMemberships],
  ];
  const evaluated = groups.flat().filter((check) => check.status !== "NOT TESTED");
  const notTested = groups.flat().filter((check) => check.status === "NOT TESTED");
  return {
    result:
      evaluated.length > 0 &&
      evaluated.every((check) => check.status === "PASS") &&
      notTested.length === 0 &&
      storageCoverage.status !== "FAIL"
        ? "PASS"
        : "FAIL",
    relationships,
    duplicateDeterministicIdentities: duplicates,
    ownership,
    invalidDates,
    futureNotNull,
    organizationMemberships,
    storageCoverage,
    truncatedTables: [...data.truncatedTables].sort(),
    warnings: data.warnings,
  };
}

function aiBudgetReport(data) {
  const organizations = tableRows(data, "organizations");
  const budgetOrganizationIds = new Set(
    tableRows(data, "ai_intelligence_budgets")
      .map((row) => row.organization_id)
      .filter(present)
  );
  const withBudget = organizations.filter((row) => budgetOrganizationIds.has(row.id));
  const withoutBudget = organizations.filter((row) => !budgetOrganizationIds.has(row.id));
  return {
    organizationCount: data.rowCounts.get("organizations") || 0,
    organizationsWithBudget: withBudget.length,
    organizationsWithoutBudget: withoutBudget.length,
    withBudgetFingerprints: withBudget
      .slice(0, 100)
      .map((row) => sha256(String(row.id)).slice(0, 16)),
    withoutBudgetFingerprints: withoutBudget
      .slice(0, 100)
      .map((row) => sha256(String(row.id)).slice(0, 16)),
    result:
      organizations.length > 0 &&
      organizations.length === withBudget.length &&
      !data.truncatedTables.has("organizations")
        ? "PASS"
        : "FAIL",
  };
}

function noDifferences(reconciliation) {
  return [
    reconciliation.sourceTablesNotInCanonical,
    reconciliation.canonicalTablesAbsentFromSource,
    reconciliation.columnDifferences,
    reconciliation.typeDifferences,
    reconciliation.nullabilityDifferences,
    reconciliation.constraintDifferences,
    reconciliation.missingIndexes,
    reconciliation.extraIndexes,
    reconciliation.changedIndexes,
    reconciliation.missingFunctions,
    reconciliation.extraFunctions,
    reconciliation.changedFunctions,
    reconciliation.missingTriggers,
    reconciliation.extraTriggers,
    reconciliation.changedTriggers,
    reconciliation.missingPolicies,
    reconciliation.extraPolicies,
    reconciliation.changedPolicies,
    reconciliation.missingRlsTables,
    reconciliation.extraRlsTables,
    reconciliation.missingExtensions,
    reconciliation.extraExtensions,
  ].every((items) => items.length === 0);
}

function readinessReport({
  manifest,
  sourceModel,
  data,
  reconciliation,
  auth,
  storage,
  integrity,
  notValid,
  ai,
}) {
  const hasDatabaseArtifact = manifest.files.some((file) =>
    ["PostgreSQL dump", "SQL"].includes(file.type)
  );
  const requiredSourceTables = [
    "organizations",
    "organization_memberships",
    "contracts",
    "documents",
    "document_versions",
  ];
  const sourceDataComplete =
    hasDatabaseArtifact &&
    requiredSourceTables.every((table) => data.observedTables.has(table)) &&
    !data.truncatedTables.size;
  const authComplete = auth.userCount > 0 && auth.membershipsWithoutAuthUser === 0;
  const storageComplete =
    storage.metadataCount > 0 &&
    storage.objectFileCount > 0 &&
    storage.metadataWithoutObject.length === 0 &&
    storage.objectsWithoutMetadata.length === 0;
  const schemaMatch = sourceModel.tables.size > 0 && noDifferences(reconciliation);
  const rlsMatch =
    sourceModel.rlsTables.size > 0 &&
    reconciliation.missingRlsTables.length === 0 &&
    reconciliation.extraRlsTables.length === 0 &&
    reconciliation.missingPolicies.length === 0 &&
    reconciliation.extraPolicies.length === 0 &&
    reconciliation.changedPolicies.length === 0;
  const authUuidPreservation =
    auth.userCount > 0 &&
    auth.organizationMembershipUserCount > 0 &&
    auth.membershipsWithoutAuthUser === 0;
  const storageObjectCoverage =
    storage.metadataCount > 0 &&
    storage.objectFileCount > 0 &&
    storage.metadataWithoutObject.length === 0 &&
    storage.objectsWithoutMetadata.length === 0;
  const notValidPass =
    notValid.every((check) => check.status === "PASS") && notValid.length === 12;
  const allMigrationInputsReady =
    sourceDataComplete &&
    authComplete &&
    storageComplete &&
    schemaMatch &&
    integrity.result === "PASS" &&
    rlsMatch &&
    authUuidPreservation &&
    storageObjectCoverage &&
    notValidPass;
  let classification = "NOT READY";
  if (sourceModel.tables.size > 0) classification = "READY FOR DESTINATION BUILD";
  if (allMigrationInputsReady && ai.result === "PASS") classification = "READY FOR DATA MIGRATION";
  return {
    "SOURCE DATA COMPLETE": sourceDataComplete ? "YES" : "NO",
    "AUTH DATA COMPLETE": authComplete ? "YES" : "NO",
    "STORAGE DATA COMPLETE": storageComplete ? "YES" : "NO",
    "SCHEMA MATCH": schemaMatch ? "YES" : "NO",
    "DATA INTEGRITY": integrity.result,
    "RLS MATCH": rlsMatch ? "PASS" : "FAIL",
    "AUTH UUID PRESERVATION": authUuidPreservation ? "PASS" : "FAIL",
    "STORAGE OBJECT COVERAGE": storageObjectCoverage ? "PASS" : "FAIL",
    "NOT VALID CONSTRAINTS": notValidPass ? "PASS" : "FAIL",
    "AI BUDGET READINESS": ai.result,
    classification,
    note:
      classification === "READY FOR DATA MIGRATION"
        ? "Offline evidence is ready for a separate, explicitly authorized disposable import rehearsal."
        : "Missing, incomplete, or uninspectable recovery evidence prevents advancement.",
    cutover:
      "This offline tool never classifies a system as READY FOR CUTOVER; application and operational validation are separately required.",
  };
}

function markdownReport(report) {
  const readiness = report.readiness;
  const lines = [
    "# Operion Offline Recovery Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Readiness",
    "",
    ...Object.entries(readiness)
      .filter(([key]) => !["note", "cutover"].includes(key))
      .map(([key, value]) => `- **${key}:** ${value}`),
    "",
    readiness.note,
    "",
    readiness.cutover,
    "",
    "## Evidence summary",
    "",
    `- Files inventoried: ${report.manifest.fileCount}`,
    `- Total bytes: ${report.manifest.totalBytes}`,
    `- Source tables identified: ${report.schema.sourceTableCount}`,
    `- Auth users identified: ${report.auth.userCount}`,
    `- Storage metadata rows: ${report.storage.metadataCount}`,
    `- Storage object files: ${report.storage.objectFileCount}`,
    "",
    "## Safety",
    "",
    "- Recovery source files were opened read-only.",
    "- No database was restored.",
    "- No migration was executed.",
    "- No network client is used by this tool.",
    "- Passwords, password hashes, tokens, secrets, and private keys are excluded.",
    "- Row violations are represented by one-way fingerprints, not raw row values.",
    "",
    "See the JSON files in this directory for machine-readable details.",
    "",
  ];
  return lines.join("\n");
}

async function writeJson(directory, name, value) {
  await fsp.writeFile(path.join(directory, name), `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

function timestampDirectoryName() {
  return `audit-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const inputDirectory = path.resolve(options.input || DEFAULT_INPUT);
  const outputDirectory = path.resolve(
    options.output || path.join(DEFAULT_REPORT_ROOT, timestampDirectoryName())
  );
  const inputStats = await fsp.stat(inputDirectory).catch(() => null);
  if (!inputStats?.isDirectory()) {
    throw new Error(`Recovery input directory does not exist: ${inputDirectory}`);
  }
  if (isInside(inputDirectory, outputDirectory)) {
    throw new Error("Output directory must not be inside the recovery input directory");
  }
  if (await fsp.stat(outputDirectory).catch(() => null)) {
    throw new Error(`Refusing to overwrite existing output directory: ${outputDirectory}`);
  }

  const [{ model: canonicalModel, files: migrations }, inventory] = await Promise.all([
    canonicalSchemaModel(),
    inventoryFiles(inputDirectory),
  ]);
  const sourceModel = createSchemaModel();
  const data = createDataStore();
  const customDumps = [];
  const structured = [];
  const archives = [];
  const restoreAvailable = pgRestoreAvailable();

  for (const file of inventory) {
    if (!file.absolutePath) continue;
    if (file.type === "SQL") {
      await inspectPlainSql(file, sourceModel, data);
    } else if (file.type === "PostgreSQL dump") {
      customDumps.push(inspectCustomDump(file, sourceModel, data, restoreAvailable));
    } else if (["JSON", "CSV", "Auth export", "Storage metadata"].includes(file.type)) {
      await inspectStructuredFile(file, data, structured);
    } else if (file.type === "ZIP/archive") {
      const customDumpResult = restoreAvailable
        ? inspectCustomDump(file, sourceModel, data, true)
        : null;
      if (customDumpResult?.inspected) customDumps.push(customDumpResult);
      else archives.push(listArchive(file));
    }
  }

  const publicManifest = {
    generatedAt: new Date().toISOString(),
    inputDirectory,
    fileCount: inventory.length,
    totalBytes: inventory.reduce((total, file) => total + file.size, 0),
    files: inventory.map(({ absolutePath: _absolutePath, ...file }) => file),
  };
  const reconciliation = compareSchemas(sourceModel, canonicalModel);
  const auth = authReport(data);
  const storage = storageReport(publicManifest, data);
  const integrity = integrityReport(data, canonicalModel, storage);
  const notValid = checkNotValidConstraints(data);
  const ai = aiBudgetReport(data);
  const schema = {
    canonicalMigrations: migrations,
    canonicalTableCount: canonicalModel.tables.size,
    sourceTableCount: sourceModel.tables.size,
    rowCounts: Object.fromEntries([...data.rowCounts.entries()].sort()),
    source: serializeSchemaModel(sourceModel),
    reconciliation,
    customDumps,
    structuredFiles: structured,
    archives,
    pgRestoreAvailable: restoreAvailable,
  };
  const readiness = readinessReport({
    manifest: publicManifest,
    sourceModel,
    data,
    reconciliation,
    auth,
    storage,
    integrity,
    notValid,
    ai,
  });
  const report = {
    generatedAt: publicManifest.generatedAt,
    manifest: publicManifest,
    schema,
    auth,
    storage,
    integrity,
    notValidConstraints: notValid,
    aiBudgetReadiness: ai,
    readiness,
  };

  await fsp.mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeJson(outputDirectory, "recovery-manifest.json", publicManifest),
    writeJson(outputDirectory, "schema-reconciliation.json", schema),
    writeJson(outputDirectory, "auth-inspection.json", auth),
    writeJson(outputDirectory, "storage-inspection.json", storage),
    writeJson(outputDirectory, "data-integrity.json", {
      ...integrity,
      notValidConstraints: notValid,
      aiBudgetReadiness: ai,
    }),
    writeJson(outputDirectory, "migration-readiness.json", readiness),
    fsp.writeFile(path.join(outputDirectory, "recovery-report.md"), markdownReport(report), {
      encoding: "utf8",
      flag: "wx",
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        result: "PASS",
        filesInventoried: publicManifest.fileCount,
        reportsWritten: 7,
        outputDirectory,
        readiness: readiness.classification,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        result: "FAIL",
        error: error.message,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
