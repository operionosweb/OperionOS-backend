import React, { useRef, useState } from "react";
import { uploadContract } from "../../lib/contractsApi";

const MAX_FILE_SIZE = Number(import.meta.env.VITE_CONTRACT_UPLOAD_MAX_BYTES || 20 * 1024 * 1024);
const MAX_FILE_SIZE_LABEL = `${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`;
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export default function UploadContract({ organizationId, onUploaded }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState("idle"); // idle | uploading | success | error
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function handleFiles(fileList) {
    const selected = fileList?.[0];
    if (!selected) return;
    const extension = selected.name.slice(selected.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_TYPES.has(selected.type) || ![".pdf", ".docx"].includes(extension)) {
      setError("Unsupported file type. Please upload a PDF or DOCX document.");
      setState("error");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError(`This file exceeds the maximum supported size of ${MAX_FILE_SIZE_LABEL}.`);
      setState("error");
      return;
    }
    setFile(selected);
    setError("");
    setSuccessMessage("");
    setState("idle");
  }

  async function handleUpload() {
    if (!file || !organizationId) return;
    setState("uploading");
    setError("");
    try {
      const result = await uploadContract({ file, organizationId });
      setSuccessMessage(result?.duplicate ? "This document has already been uploaded." : "Contract uploaded and ready for analysis.");
      setState("success");
      onUploaded?.(result);
    } catch (err) {
      setState("error");
      setError(err.message || "Upload failed.");
    }
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="op-surface"
        style={{
          padding: "var(--op-space-7)",
          textAlign: "center",
          cursor: "pointer",
          borderStyle: "dashed",
          borderColor: dragOver ? "var(--op-accent)" : "var(--op-border-strong)",
          transition: "border-color var(--op-duration-fast) var(--op-ease)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          hidden
          onChange={(event) => handleFiles(event.target.files)}
        />
        <p className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>
          {file ? file.name : "Drop a contract PDF, or click to select"}
        </p>
        <p className="op-body">PDF or DOCX, up to {MAX_FILE_SIZE_LABEL}.</p>
        {file && <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>{(file.size / 1024 / 1024).toFixed(2)} MB selected</p>}
      </div>

      {error && (
        <p className="op-body" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>
          {error}
        </p>
      )}

      {state === "success" && (
        <p className="op-body" style={{ color: "var(--op-signal-good)", marginTop: "var(--op-space-3)" }}>
          {successMessage}
        </p>
      )}

      {file && state !== "success" && (
        <button
          type="button"
          className="op-btn op-btn-primary"
          style={{ marginTop: "var(--op-space-4)" }}
          onClick={handleUpload}
          disabled={state === "uploading" || !organizationId}
        >
          {state === "uploading" ? "Uploading…" : "Upload contract"}
        </button>
      )}
    </div>
  );
}
