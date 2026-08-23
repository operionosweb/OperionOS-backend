import React, { useRef, useState } from "react";
import { uploadContract } from "../../lib/contractsApi";

export default function UploadContract({ organizationId, onUploaded }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState("idle"); // idle | uploading | success | error
  const [error, setError] = useState("");

  function handleFiles(fileList) {
    const selected = fileList?.[0];
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      setState("error");
      return;
    }
    setFile(selected);
    setError("");
    setState("idle");
  }

  async function handleUpload() {
    if (!file || !organizationId) return;
    setState("uploading");
    setError("");
    try {
      const result = await uploadContract({ file, organizationId });
      if (result?.analysisRunId) {
        try {
          localStorage.setItem("operion.activeAnalysisRunId", result.analysisRunId);
        } catch (storageError) {
          console.warn("Could not persist active analysis run id", storageError);
        }
      }
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
          accept="application/pdf"
          hidden
          onChange={(event) => handleFiles(event.target.files)}
        />
        <p className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>
          {file ? file.name : "Drop a contract PDF, or click to select"}
        </p>
        <p className="op-body">PDF only, up to 20MB.</p>
      </div>

      {error && (
        <p className="op-body" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>
          {error}
        </p>
      )}

      {state === "success" && (
        <p className="op-body" style={{ color: "var(--op-signal-good)", marginTop: "var(--op-space-3)" }}>
          Upload received — analysis started.
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
