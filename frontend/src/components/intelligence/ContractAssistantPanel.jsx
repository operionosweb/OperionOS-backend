import React from "react";
import { useParams } from "react-router-dom";
import { MattExperience } from "../../routes/Matt";
import RequireOrganizationPermission from "../auth/RequireOrganizationPermission";
import { ORGANIZATION_PERMISSIONS } from "../../lib/permissions";

export default function ContractAssistantPanel({ analysisRunId, organizationId }) {
  const { id } = useParams();
  return <RequireOrganizationPermission permission={ORGANIZATION_PERMISSIONS.CONTRACT_READ}>
    <MattExperience key={`${organizationId}-${id}-${analysisRunId}`} organizationId={organizationId} contract={{ id, title: "Selected workspace contract" }} analysisRunId={analysisRunId}/>
  </RequireOrganizationPermission>;
}
