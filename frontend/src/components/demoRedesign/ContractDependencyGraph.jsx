import React, { useMemo, useState } from "react";
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DemoBadge } from "../../demo/DemoUI";

const positions = {
  aircraft:[20,155], lease:[260,155], maintenance:[520,40], insurance:[520,155], hull:[520,270],
  "engine-supply":[790,0], "shop-visit":[790,80], reinsurance:[790,135], broker:[790,215], component:[790,290],
};

function NodeCard({ data }) {
  return <div className={`od-graph-node od-graph-node-${data.type}`}><Handle type="target" position={Position.Left}/><span>{data.type}</span><strong>{data.label}</strong><small>{data.subtitle}</small><DemoBadge tone="success">{data.status}</DemoBadge><Handle type="source" position={Position.Right}/></div>;
}

const nodeTypes = { operion: NodeCard };

export default function ContractDependencyGraph({ graph, onOpenContract }) {
  const [selected,setSelected] = useState(null);
  const nodes = useMemo(()=>graph.nodes.map(item=>({ id:item.id, type:"operion", position:{x:positions[item.id]?.[0]||0,y:positions[item.id]?.[1]||0}, data:item })),[graph]);
  const edges = useMemo(()=>graph.edges.map(item=>({ ...item, label:item.relationship, markerEnd:{type:MarkerType.ArrowClosed}, style:{stroke:item.relationship==="insures"?"#5678dd":"#7657ec",strokeWidth:1.5}, labelStyle:{fill:"#59637b",fontSize:10,fontWeight:700}, animated:item.relationship==="depends on" })),[graph]);
  return <div className="od-graph-wrap"><div className="od-graph-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.35} maxZoom={1.8} onNodeClick={(_,node)=>setSelected({kind:"node",...node.data})} onNodeDoubleClick={(_,node)=>node.data.contractId&&onOpenContract?.(node.data.contractId)} onEdgeClick={(_,edge)=>setSelected({kind:"edge",...graph.edges.find(item=>item.id===edge.id)})} nodesDraggable={false} proOptions={{hideAttribution:true}}><Background color="#dfe4f2" gap={22}/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor="#7657ec"/></ReactFlow></div><aside className="od-graph-inspector"><DemoBadge>DEMO RELATIONSHIP</DemoBadge>{selected?.kind==="node"?<><span>{selected.type}</span><h3>{selected.label}</h3><p>{selected.subtitle}</p>{selected.contractId&&<button className="od-button od-button-primary" type="button" onClick={()=>onOpenContract?.(selected.contractId)}>Open contract</button>}</>:selected?.kind==="edge"?<><span>Relationship</span><h3>{selected.relationship}</h3><p>{graph.nodes.find(item=>item.id===selected.source)?.label} → {graph.nodes.find(item=>item.id===selected.target)?.label}</p><p>Prepared relationship fixture. No production evidence is claimed.</p></>:<><span>Dependency inspector</span><h3>Select a node or edge</h3><p>Explore the prepared aircraft-to-contract relationship model.</p></>}</aside></div>;
}
