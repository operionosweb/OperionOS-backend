import React, { useMemo } from "react";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

function RelationshipNode({ data }) {
  return <div className={`op-dependency-node is-${data.type}`}><Handle type="target" position={Position.Left}/><span>{data.type}</span><strong>{data.label}</strong><small>{data.status || "Status unavailable"}</small><Handle type="source" position={Position.Right}/></div>;
}

const nodeTypes = { relationship: RelationshipNode };

export default function ProductionDependencyGraph({ aircraft, intelligence, onClose }) {
  const nodes = useMemo(() => [
    { id: "aircraft", type: "relationship", position: { x: 20, y: 150 }, data: { type: "aircraft", label: aircraft.registration || "Aircraft", status: intelligence.organizationRelationship } },
    ...intelligence.contracts.map((contract, index) => ({ id: contract.contract_id, type: "relationship", position: { x: 300, y: index * 120 }, data: { type: "contract", label: contract.title, status: contract.status } })),
  ], [aircraft, intelligence]);
  const edges = useMemo(() => intelligence.contracts.map((contract) => ({
    id: `${aircraft.id}-${contract.contract_id}`,
    source: "aircraft",
    target: contract.contract_id,
    label: contract.relationship_type.replaceAll("_", " "),
    markerEnd: { type: MarkerType.ArrowClosed },
  })), [aircraft.id, intelligence]);

  return <div className="op-dependency-backdrop"><section className="op-dependency-dialog" role="dialog" aria-modal="true" aria-label="Contract dependency tree"><header><div><span className="op-eyebrow">Aircraft contract context</span><h2>Contract Dependency Tree</h2><p>Only configured, organization-scoped relationships are shown.</p></div><button className="op-sheet-close" onClick={onClose} aria-label="Close dependency tree">×</button></header><div><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView nodesDraggable={false} minZoom={0.35} maxZoom={2} proOptions={{ hideAttribution: true }}><Background color="#dfe3ef" gap={22}/><Controls showInteractive={false}/></ReactFlow></div></section></div>;
}