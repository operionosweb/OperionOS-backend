# Offline Supabase recovery audit

This tool inspects downloaded recovery files without contacting Supabase, Render,
Vercel, or any other network service. It never restores a database, runs a
migration, uploads an object, or modifies a recovery source file.

## Recovery file location

Place the files supplied by Supabase under:

```text
recovery/source/
```

Preserve the supplied directory structure and filenames. Do not extract or edit
an original database dump. ZIP and TAR archives may be placed in the directory
unchanged.

Both `recovery/source/` and `recovery/reports/` are ignored by Git to reduce the
risk of committing recovered production material.

## Run the audit

From the repository root:

```powershell
npm.cmd run recovery:audit
```

The default input is `recovery/source/`. A unique report directory is created
under `recovery/reports/`.

For an input or output location outside the repository:

```powershell
npm.cmd run recovery:audit -- --input "C:\Operion-Recovery\source" --output "C:\Operion-Recovery\reports\audit-001"
```

The output directory must not already exist and must not be inside the source
directory. The tool refuses to overwrite an earlier report.

## Reports produced

Each run writes:

- `recovery-manifest.json`: path, size, extension, SHA-256, timestamps, and
  likely file type.
- `schema-reconciliation.json`: source schema inventory and comparison with
  canonical migrations `001-021`.
- `auth-inspection.json`: redacted Auth counts, UUID fingerprints, masked
  emails, providers, dates, and membership coverage.
- `storage-inspection.json`: buckets, metadata, object paths, sizes, MIME
  types, hashes, canonical-path compliance, and metadata/object coverage.
- `data-integrity.json`: relationship, duplicate, ownership, date, future
  `NOT NULL`, twelve `NOT VALID` constraint, and AI-budget checks.
- `migration-readiness.json`: required YES/NO and PASS/FAIL readiness fields.
- `recovery-report.md`: concise human-readable summary.

The tool recognizes plain SQL, PostgreSQL custom-format dumps, JSON, CSV, ZIP,
TAR and common archive extensions. Plain SQL `COPY` data can be counted and
checked without restoring it. If `pg_restore` is installed, custom or TAR dump
catalogs are listed with `pg_restore --list`; they are never restored.

## Sensitive information

The reports never include:

- passwords or password hashes
- access or refresh tokens
- JWT or service-role secrets
- private keys, nonces, salts, or recovery tokens
- raw rows that violate integrity checks

Emails are masked. UUIDs used in user summaries and failing-row samples are
represented by one-way SHA-256 fingerprints. Source files are hashed but never
rewritten.

Keep the source and generated reports in encrypted, access-controlled local
storage. Reports still contain schema names, filenames, object paths, counts,
and other potentially sensitive operational metadata.

## Read-only and offline guarantees

The script contains no HTTP, Supabase, Render, or Vercel client. It reads local
files and the checked-in migration SQL only. It does not read application
environment files. It does not execute SQL. It does not start Docker.

The only optional external commands are:

- `pg_restore --version`
- `pg_restore --list <local file>`
- `tar -tf <local file>`

Both commands inspect local files without connecting to a database or
extracting the archive.

## Limitations

- Exact row-level checks for a custom PostgreSQL dump require a later,
  explicitly authorized restore into a disposable local database. This tool
  does not perform that restore.
- Archive entries are listed but nested exports are not automatically
  extracted.
- Static SQL parsing is conservative. Dynamic SQL or vendor-specific DDL may
  be reported as unknown or as a difference requiring manual review.
- Constraint-backed indexes are reconciled through their constraints; the
  standalone index comparison focuses on explicit `CREATE INDEX` objects.
- CSV and JSON files need recognizable table-oriented structures. Unknown
  structures remain in the manifest but are not treated as database rows.
- A successful offline audit can reach `READY FOR DATA MIGRATION`, but never
  `READY FOR CUTOVER`. Cutover additionally requires application, operational,
  and destination validation.
