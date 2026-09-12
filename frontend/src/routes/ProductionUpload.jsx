import React from "react";
import { useNavigate } from "react-router-dom";
import { FileCheck2, ScanText, ShieldCheck, Sparkles } from "lucide-react";
import OrganizationGate from "../components/demo/OrganizationGate";
import UploadContract from "../components/demo/UploadContract";
import { useOrganization } from "../context/OrganizationContext";

function UploadExperience({ organizationId }) {
  const navigate = useNavigate();
  return <div className="op-upload-layout"><section className="op-upload-stage"><div className="op-section-heading"><div><span className="op-page-kicker">Secure contract upload</span><h2>Choose an aviation contract</h2></div><ShieldCheck size={21} color="var(--op-color-success)" /></div><p className="op-body" style={{ marginBottom: "var(--op-space-5)" }}>Upload an aviation contract and let Operion identify clauses, obligations, deadlines and potential risks.</p><UploadContract organizationId={organizationId} onUploaded={(result) => { if (result?.duplicate) return; if (result?.contractId) { try { if (result.analysisRunId) localStorage.setItem(`operion.activeAnalysisRunId.${result.contractId}`, result.analysisRunId); } catch {} navigate(`/app/contracts/${result.contractId}`); } }} /><div className="op-honest-boundary" style={{ marginTop: 16 }}><strong>Your document remains organisation-scoped</strong><p>Operion validates and structures the document securely. Contract Intelligence begins only when you choose Analyse contract in the workspace.</p></div></section><aside className="op-intelligence-panel"><div className="op-section-heading"><div><span className="op-page-kicker">What happens next</span><h2>From document to intelligence</h2></div></div><div className="op-process-steps">{[["1", "Upload", "PDF or DOCX, up to 20 MiB", FileCheck2], ["2", "Validate and structure", "Type, size, duplicate, pages and sections", ShieldCheck], ["3", "Analyse the contract", "Clauses, obligations, deadlines and risks", ScanText], ["4", "Review intelligence", "Summary, evidence, search and grounded actions", Sparkles]].map(([number, title, note]) => <div className="op-process-step" key={title}><i>{number}</i><div><strong>{title}</strong><small>{note}</small></div></div>)}</div></aside></div>;
}

export default function ProductionUpload() {
  const { organizationId } = useOrganization();
  return <><header className="op-page-heading"><div><span className="op-page-kicker">Contract Intelligence</span><h1>Analyse a contract</h1><p>Start with a secure aviation contract upload. Operion will structure the document before analysis begins.</p></div></header><OrganizationGate><UploadExperience organizationId={organizationId} /></OrganizationGate></>;
}
