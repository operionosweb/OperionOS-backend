# Step 2 Contract Upload and Ingestion

The authenticated contract workflow is available at `/api/contracts/upload` and the Contracts workspace at `/demo/contracts`.

Supported formats are PDF and DOCX. The default server-side limit is 20 MiB and can be changed with `CONTRACT_UPLOAD_MAX_BYTES`; the frontend can mirror that value with `VITE_CONTRACT_UPLOAD_MAX_BYTES` for user feedback. Server validation remains authoritative.

Upload performs validation, SHA-256 hashing, organization-scoped duplicate detection, private Supabase Storage upload, contract/document/version registration, and deterministic PDF/DOCX text metadata extraction. It returns a `ready` status for later intelligence analysis. Upload does not call the AI Gateway, embeddings, clause extraction, or risk analysis and consumes zero AI Intelligence Budget.

Storage uses the private `contract-documents` bucket and paths shaped as `organizations/{organization}/documents/{document}/versions/{version}/source.{pdf|docx}`. The processing status endpoint is `/api/contracts/:id/processing-status`; it is authenticated and organization-scoped.

Migration `008_contract_upload_docx.sql` updates MIME constraints and private storage policies. A dedicated Supabase test database was not available, so live RLS/storage execution remains to be verified outside production.
