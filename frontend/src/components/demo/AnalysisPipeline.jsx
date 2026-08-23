import React from "react";

const PIPELINE = ["queued", "processing", "extracting", "analysing", "indexing", "completed"];
const TERMINAL_FAILURE = ["failed", "cancelled", "requires_review"];

export default function AnalysisPipeline({ status }) {
  const isFailure = TERMINAL_FAILURE.includes(status);
  const activeIndex = PIPELINE.indexOf(status);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--op-space-2)" }}>
        {PIPELINE.map((stage, index) => {
          const reached = !isFailure && activeIndex >= index;
          const isCurrent = stage === status;
          return (
            <span
              key={stage}
              className={isCurrent ? "op-badge op-badge-live" : "op-badge"}
              style={{ opacity: reached || isCurrent ? 1 : 0.4 }}
            >
              {stage}
            </span>
          );
        })}
      </div>

      {isFailure && (
        <p className="op-body" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>
          Status: {status}
        </p>
      )}
    </div>
  );
}
