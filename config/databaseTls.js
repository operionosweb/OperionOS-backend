import { X509Certificate } from "node:crypto";
import { checkServerIdentity } from "node:tls";

export function createDatabaseConfig(env = process.env) {
  const options = { max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 };
  if (!env.DATABASE_URL) return { ...options, ssl: { rejectUnauthorized: true } };

  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("Invalid database connection configuration.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname || url.pathname === "/") {
    throw new Error("Invalid database connection configuration.");
  }
  for (const key of [...url.searchParams.keys()]) {
    const name = key.toLowerCase();
    if (name.startsWith("ssl")) {
      if (name !== "sslmode" || url.searchParams.getAll(key).some(value => value.toLowerCase() !== "verify-full")) {
        throw new Error("Database URL contains unsupported or insecure TLS options.");
      }
      url.searchParams.delete(key);
    } else if (["host", "hostaddr", "port", "user", "password", "database", "dbname"].includes(name)) {
      throw new Error("Database URL cannot override connection identity in query parameters.");
    }
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const ssl = {
    rejectUnauthorized: true,
    checkServerIdentity: (_serverName, certificate) => checkServerIdentity(host, certificate),
  };
  if (env.DATABASE_CA) {
    const pattern = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
    const certificates = env.DATABASE_CA.match(pattern);
    if (!certificates?.length || env.DATABASE_CA.replace(pattern, "").trim()) {
      throw new Error("Database CA must contain PEM certificates.");
    }
    try {
      for (const pem of certificates) {
        const certificate = new X509Certificate(pem);
        if (!certificate.ca || Date.parse(certificate.validFrom) > Date.now() || Date.parse(certificate.validTo) <= Date.now()) {
          throw new Error("Invalid trust certificate.");
        }
      }
    } catch {
      throw new Error("Database CA contains an invalid trust certificate.");
    }
    ssl.ca = env.DATABASE_CA;
  }
  return { ...options, connectionString: url.toString(), ssl };
}

export function isVerifiedDatabaseConnection(client) {
  const stream = client.connection?.stream;
  const strict = client.ssl === true || (client.ssl && typeof client.ssl === "object" && client.ssl.rejectUnauthorized !== false);
  return Boolean(strict && stream?.encrypted && stream.authorized === true && client.host &&
    typeof stream.getPeerCertificate === "function" &&
    !checkServerIdentity(client.host, stream.getPeerCertificate()));
}
