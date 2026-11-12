# Step 2 Contract Upload and Ingestion

The authenticated contract workflow is available at `/api/contracts/upload` and the production workspace at `/app/contracts`.

Supported formats are PDF and DOCX. The default server-side limit is 20 MiB and can be changed with `CONTRACT_UPLOAD_MAX_BYTES`; the frontend can mirror that value with `VITE_CONTRACT_UPLOAD_MAX_BYTES` for user feedback. Server validation remains authoritative.

Upload performs validation, SHA-256 hashing, organization-scoped duplicate detection, private Supabase Storage upload, contract/document/version registration, and deterministic PDF/DOCX text metadata extraction. It returns `ready` only after extraction and structure persistence; incomplete PDF OCR is reported as `requires_ocr`, while a DOCX without readable text is rejected. Upload does not call the AI Gateway, embeddings, clause extraction, or risk analysis and consumes zero AI Intelligence Budget.

DOCX extraction does not establish original page numbers. New DOCX structures retain text offsets but do not persist synthetic page rows or page references. Previously persisted DOCX results may contain misleading page references and require review; this change does not rewrite existing data or completed analyses.

Storage uses the private `contract-documents` bucket and paths shaped as `organizations/{organization}/documents/{document}/versions/{version}/source.{pdf|docx}`. The processing status endpoint is `/api/contracts/:id/processing-status`; it is authenticated and organization-scoped.

Migration `008_contract_upload_docx.sql` updates MIME constraints and private storage policies. These definitions are not proof that the intended hosted project has the required schema, private bucket, or effective policies. Verify them in an authorized isolated environment before production use.
