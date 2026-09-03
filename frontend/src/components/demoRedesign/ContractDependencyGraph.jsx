import React, { useMemo, useState } from "react";
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DemoBadge } from "../../demo/DemoUI";

function NodeCard({ data }) {
  return <div className={`od-graph-node od-graph-node-${data.type}`}><Handle type="target" position={Position.Left}/><span>{data.type}</span><strong>{data.label}</strong><small>{data.subtitle}</small><DemoBadge tone="success">{data.status}</DemoBadge><Handle type="source" position={Position.Right}/></div>;
}

const nodeTypes = { operion: NodeCard };

export default function ContractDependencyGraph({ graph, onOpenContract }) {
  const [selected,setSelected] = useState(null);
  const nodes = useMemo(()=>{const indexes={aircraft:0,contract:0,supplier:0,obligation:0,dependency:0};const columns={aircraft:20,contract:270,supplier:520,obligation:770,dependency:1020};return graph.nodes.map(item=>{const index=indexes[item.type]++;const count=graph.nodes.filter(node=>node.type===item.type).length;return {id:item.id,type:"operion",position:{x:columns[item.type],y:150+index*125-(count-1)*62.5},data:item};});},[graph]);
  const edges = useMemo(()=>graph.edges.map(item=>({ ...item, label:item.relationship, markerEnd:{type:MarkerType.ArrowClosed}, style:{stroke:item.relationship==="insures"?"#5678dd":"#7657ec",strokeWidth:1.5}, labelStyle:{fill:"#59637b",fontSize:10,fontWeight:700}, animated:item.relationship==="depends on" })),[graph]);
  return <div className="od-graph-wrap"><div className="od-graph-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.35} maxZoom={1.8} onNodeClick={(_,node)=>setSelected({kind:"node",...node.data})} onNodeDoubleClick={(_,node)=>node.data.contractId&&onOpenContract?.(node.data.contractId)} onEdgeClick={(_,edge)=>setSelected({kind:"edge",...graph.edges.find(item=>item.id===edge.id)})} nodesDraggable={false} proOptions={{hideAttribution:true}}><Background color="#dfe4f2" gap={22}/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor="#7657ec"/></ReactFlow></div><aside className="od-graph-inspector"><DemoBadge>DEMO RELATIONSHIP</DemoBadge>{selected?.kind==="node"?<><span>{selected.type}</span><h3>{selected.label}</h3><p>{selected.subtitle}</p>{selected.contractId&&<button className="od-button od-button-primary" type="button" onClick={()=>onOpenContract?.(selected.contractId)}>Open contract</button>}</>:selected?.kind==="edge"?<><span>Relationship</span><h3>{selected.relationship}</h3><p>{graph.nodes.find(item=>item.id===selected.source)?.label} → {graph.nodes.find(item=>item.id===selected.target)?.label}</p><p>Prepared relationship fixture. No production evidence is claimed.</p></>:<><span>Dependency inspector</span><h3>Select a node or edge</h3><p>Explore the prepared aircraft-to-contract relationship model.</p></>}</aside></div>;
}
