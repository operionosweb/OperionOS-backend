import assert from "node:assert/strict";
import test from "node:test";
import { rootCertificates } from "node:tls";
import pg from "pg";
import { createDatabaseConfig } from "../config/databaseTls.js";

test("main database configuration preserves certificate and hostname verification with verify-full", () => {
  const config = createDatabaseConfig({
    DATABASE_URL: "postgresql://fixture:synthetic@db.example.test:5432/fixture?sslmode=verify-full",
    DATABASE_CA: rootCertificates[0],
  });
  const client = new pg.Client(config);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(client.ssl.rejectUnauthorized, true);
  assert.equal(client.host, "db.example.test");
  assert.equal(config.ssl.checkServerIdentity("unused", { subjectaltname: "DNS:db.example.test" }), undefined);
  assert.ok(config.ssl.checkServerIdentity("unused", { subjectaltname: "DNS:other.example.test" }));
  assert.equal(config.ssl.ca, rootCertificates[0]);
  assert.equal(new URL(config.connectionString).searchParams.has("sslmode"), false);
});

test("main database configuration rejects unsafe overrides and invalid trust material", () => {
  for (const suffix of ["?sslmode=disable", "?sslmode=require", "?ssl=false", "?sslrootcert=bad", "?host=other.example.test"]) {
    assert.throws(() => createDatabaseConfig({ DATABASE_URL: `postgres://fixture:synthetic@db.example.test/fixture${suffix}` }));
  }
  assert.throws(() => createDatabaseConfig({ DATABASE_URL: "postgres://fixture@db.example.test/fixture", DATABASE_CA: "not a certificate" }));
  assert.equal(createDatabaseConfig({}).ssl.rejectUnauthorized, true);
});
