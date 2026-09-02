import React from "react";
import { useParams } from "react-router-dom";
import { Building2, Settings, Users } from "lucide-react";
import { DemoBadge, EmptyState, GlassCard, PageHeader } from "../../demo/DemoUI";

const content = {
  organisation: { icon: Building2, title: "Organisation", description: "Prepared organisation profile for the demonstration environment.", rows: [["Organisation","Aviation Partners Ltd."],["Industry","Aircraft leasing"],["Region","Europe"],["Environment","Demonstration only"]] },
  users: { icon: Users, title: "Users", description: "Illustrative access overview. No demo user changes are persisted.", rows: [["John Smith","Administrator"],["Sarah Chen","Legal reviewer"],["David Okafor","Fleet analyst"]] },
  settings: { icon: Settings, title: "Settings", description: "Demo preferences are intentionally limited and are not production configuration.", rows: [["Interface","Light"],["Reduced motion","Uses device preference"],["Aviation data","Synthetic provider"],["Contract data","Prepared demo fixtures"]] },
};

export default function DemoAdmin() {
  const { admin = "organisation" } = useParams();
  const page = content[admin] || content.organisation;
  const Icon = page.icon;
  return <><PageHeader eyebrow="Admin / demonstration" title={page.title} description={page.description} actions={<DemoBadge>DEMO MODE</DemoBadge>}/><div className="od-admin-layout"><GlassCard title={`${page.title} information`} eyebrow="Prepared configuration"><div className="od-admin-rows">{page.rows.map(([label,value])=><div key={label}><span><Icon size={16}/>{label}</span><strong>{value}</strong></div>)}</div></GlassCard><EmptyState title="Changes are disabled in Demo Mode" description="Production organisation, user, and application configuration require authenticated server-backed services."/></div></>;
}
