import React from "react";
import { Link } from "react-router-dom";
import { FileCheck2, LockKeyhole, ScanText, Upload } from "lucide-react";
import UploadContract from "../../components/demo/UploadContract";
import OrganizationGate from "../../components/demo/OrganizationGate";
import { useAuth } from "../../context/AuthContext";
import { useOrganization } from "../../context/OrganizationContext";
import { DemoBadge, GlassCard, PageHeader } from "../../demo/DemoUI";

function RealUpload({ organizationId }) {
  return <OrganizationGate><UploadContract organizationId={organizationId} onUploaded={()=>{}} /></OrganizationGate>;
}

export default function DemoUpload() {
  const auth = useAuth();
  const { organizationId } = useOrganization();
  return <>
    <PageHeader eyebrow="Secure ingestion" title="Upload a contract" description="Register a real PDF or DOCX through Operion’s validated, organisation-scoped upload pipeline." actions={<DemoBadge tone="success">REAL UPLOAD API</DemoBadge>} />
    <div className="od-upload-grid">
      <GlassCard title="Bring a contract into Operion" eyebrow="PDF or DOCX / up to 20 MiB" className="od-upload-card">
        {auth?.isAuthenticated ? <RealUpload organizationId={organizationId}/> : <div className="od-auth-boundary"><span><LockKeyhole size={24}/></span><h3>Sign in to use secure upload</h3><p>The demo does not bypass authentication or organisation isolation. Sign in to upload through the real production API.</p><Link className="od-button od-button-primary" to="/login">Sign in securely</Link></div>}
      </GlassCard>
      <GlassCard title="Deterministic first" eyebrow="Processing sequence">
        <div className="od-upload-steps">{[[Upload,"Upload","Private source registration"],[FileCheck2,"Validate","Format, size, hash, duplicate"],[ScanText,"Structure","Pages, sections, subsections, chunks"],[FileCheck2,"Analyse","Explicit user action in workspace"]].map(([Icon,title,note],index)=><div key={title}><span><Icon size={17}/></span><i>{index+1}</i><p><strong>{title}</strong><small>{note}</small></p></div>)}</div>
        <div className="od-honesty-note"><strong>No automatic AI spend</strong><p>Uploading prepares the document. Clause, obligation, deadline, and risk analysis remain explicit actions controlled by the production backend.</p></div>
      </GlassCard>
    </div>
  </>;
}
