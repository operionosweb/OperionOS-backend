import crypto from "node:crypto";
import { query as defaultQuery } from "../db.js";
import { assertOrganizationScope, assertResourceId } from "../repositories/phase3/scope.js";

function scope(organizationId, id, name) {
  assertOrganizationScope(organizationId);
  if (id !== undefined && id !== null) assertResourceId(id, name);
}

export function createContractIntelligenceDomain(query = defaultQuery) {
  return {
    async createContract({ organizationId, userId, title, contractType = null, counterpartyReference = null }) {
      scope(organizationId);
      assertResourceId(userId, "userId");
      if (!title?.trim()) throw new TypeError("title is required");
      const result = await query(`INSERT INTO contracts (organization_id, created_by, title, contract_type, counterparty_reference) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [organizationId, userId, title.trim(), contractType, counterpartyReference]);
      return result.rows[0];
    },
    async createContractVersion({ organizationId, contractId, documentId, userId, versionNumber, versionIdentifier = null, sha256, storageKey, mimeType = "application/pdf", fileSize, pageCount = null }) {
      scope(organizationId, contractId, "contractId");
      assertResourceId(documentId, "documentId"); assertResourceId(userId, "userId");
      if (!/^[0-9a-f]{64}$/.test(sha256 || "")) throw new TypeError("sha256 must be a SHA-256 hash");
      const result = await query(`INSERT INTO document_versions (document_id, organization_id, contract_id, version_number, version_identifier, sha256, storage_key, mime_type, file_size, page_count, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`, [documentId, organizationId, contractId, versionNumber, versionIdentifier, sha256, storageKey, mimeType, fileSize, pageCount, userId]);
      return result.rows[0];
    },
    async registerDocument({ organizationId, contractId, userId, filename, mimeType, fileSize, storageKey, sha256 }) {
      scope(organizationId, contractId, "contractId"); assertResourceId(userId, "userId");
      if (!/^[0-9a-f]{64}$/.test(sha256 || "")) throw new TypeError("sha256 must be a SHA-256 hash");
      const result = await query(`INSERT INTO documents (organization_id, contract_id, created_by, filename, mime_type, file_size, storage_key, sha256, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded') RETURNING *`, [organizationId, contractId, userId, filename, mimeType, fileSize, storageKey, sha256]);
      return result.rows[0];
    },
    async getContract({ organizationId, contractId }) { scope(organizationId, contractId, "contractId"); const result = await query("SELECT * FROM contracts WHERE organization_id = $1 AND id = $2", [organizationId, contractId]); return result.rows[0] || null; },
    async getContractVersion({ organizationId, versionId }) { scope(organizationId, versionId, "versionId"); const result = await query("SELECT * FROM document_versions WHERE organization_id = $1 AND id = $2", [organizationId, versionId]); return result.rows[0] || null; },
    async listContracts({ organizationId, limit = 50, offset = 0 }) { scope(organizationId); const result = await query("SELECT * FROM contracts WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3", [organizationId, Math.min(Math.max(Number(limit) || 50, 1), 100), Math.max(Number(offset) || 0, 0)]); return result.rows; },
    async getDocument({ organizationId, documentId }) { scope(organizationId, documentId, "documentId"); const result = await query("SELECT * FROM documents WHERE organization_id = $1 AND id = $2", [organizationId, documentId]); return result.rows[0] || null; },
    async updateProcessingStatus({ organizationId, documentId, status }) { scope(organizationId, documentId, "documentId"); const allowed = new Set(["uploaded", "queued", "processing", "processed", "ready", "failed", "requires_ocr"]); if (!allowed.has(status)) throw new TypeError("Invalid document processing status"); const result = await query("UPDATE documents SET status = $1, updated_at = now() WHERE organization_id = $2 AND id = $3 RETURNING *", [status, organizationId, documentId]); return result.rows[0] || null; },
    async getContractStructure({ organizationId, versionId }) { scope(organizationId, versionId, "versionId"); const result = await query("SELECT * FROM contract_sections WHERE organization_id = $1 AND document_version_id = $2 ORDER BY section_order", [organizationId, versionId]); return result.rows; },
    hashContent(content) { return crypto.createHash("sha256").update(String(content), "utf8").digest("hex"); },
  };
}