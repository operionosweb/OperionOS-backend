import React from "react";
import { useNavigate } from "react-router-dom";
import { FileCheck2, ScanText, ShieldCheck, Sparkles } from "lucide-react";
import OrganizationGate from "../components/demo/OrganizationGate";
import UploadContract from "../components/demo/UploadContract";
import { useOrganization } from "../context/OrganizationContext";

function UploadExperience({ organizationId }) {
  const navigate = useNavigate();
  return <div className="op-upload-layout"><section className="op-upload-stage"><div className="op-section-heading"><div><span className="op-page-kicker">Secure ingestion</span><h2>Choose a contract document</h2></div><ShieldCheck size={21} color="var(--op-color-success)" /></div><UploadContract organizationId={organizationId} onUploaded={(result) => { if (result?.duplicate) return; if (result?.contractId) { try { if (result.analysisRunId) localStorage.setItem(`operion.activeAnalysisRunId.${result.contractId}`, result.analysisRunId); } catch {} navigate(`/app/contracts/${result.contractId}`); } }} /><div className="op-honest-boundary" style={{ marginTop: 16 }}><strong>Uploading does not consume Intelligence Budget</strong><p>Operion validates and structures the document first. You explicitly choose which intelligence analyses to run from the contract workspace.</p></div></section><aside className="op-intelligence-panel"><div className="op-section-heading"><div><span className="op-page-kicker">Processing path</span><h2>From file to intelligence</h2></div></div><div className="op-process-steps">{[["1", "Upload", "PDF or DOCX, up to 20 MiB", FileCheck2], ["2", "Validate", "Type, size, hash, and duplicate checks", ShieldCheck], ["3", "Structure", "Pages, sections, subsections, and chunks", ScanText], ["4", "Analyse", "Started explicitly from the workspace", Sparkles]].map(([number, title, note]) => <div className="op-process-step" key={title}><i>{number}</i><div><strong>{title}</strong><small>{note}</small></div></div>)}</div></aside></div>;
}

export default function ProductionUpload() {
  const { organizationId } = useOrganization();
  return <><header className="op-page-heading"><div><span className="op-page-kicker">Upload contract</span><h1>Bring a contract into Operion</h1><p>Private, organisation-scoped ingestion with deterministic processing first.</p></div></header><OrganizationGate><UploadExperience organizationId={organizationId} /></OrganizationGate></>;
}
