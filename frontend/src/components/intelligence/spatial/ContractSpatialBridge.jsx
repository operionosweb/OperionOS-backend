import React from "react";
import SpatialPanel from "../SpatialPanel";
import EntityFocus from "../EntityFocus";
import EvidenceInspector from "../EvidenceInspector";
import ImpactPath from "../ImpactPath";
import ScenarioBranch from "../ScenarioBranch";
import Timeline from "../Timeline";
import SpatialViewport from "./SpatialViewport";
import SpatialLayerManager from "./SpatialLayerManager";
import SpatialInspectorBridge from "./SpatialInspectorBridge";
import SpatialModeToggle from "./SpatialModeToggle";
import SpatialBreadcrumb from "./SpatialBreadcrumb";
import SpatialStage from "./SpatialStage";
import SpatialEntity from "./SpatialEntity";
import SpatialConnection from "./SpatialConnection";
import SpatialFocus from "./SpatialFocus";
import SpatialTransition from "./SpatialTransition";
import { createSpatialEntity, createSpatialEdge } from "./SpatialEntityModel";
import { SpatialInteractionProvider, useSpatialInteractionBus } from "./SpatialInteractionBus";
import { CONTRACT_INTELLIGENCE_HIERARCHY, INTELLIGENCE_AVAILABILITY } from "../../../lib/contractIntelligenceModel";

const SPATIAL_LAYERS = [
  { id: "operational", label: "Operational entities" },
  { id: "contract", label: "Contract dependencies" },
  { id: "impact", label: "Impact path" },
];

const WORKSPACE_STAGES = CONTRACT_INTELLIGENCE_HIERARCHY
  .filter((node) => node.id !== "recommendations")
  .map((node) => ({
    id: node.id,
    label: node.label,
    availability: ["contract", "document", "analysis"].includes(node.id)
      ? INTELLIGENCE_AVAILABILITY.AVAILABLE
      : INTELLIGENCE_AVAILABILITY.UNAVAILABLE,
  }));

export default function ContractSpatialBridge({ contract, documents = [], analysisRun = null, clauses = [], obligations = [] }) {
  return (
    <SpatialInteractionProvider>
      <SpatialPanel
        title="Dependency context"
        description="Spatial intelligence language demonstration backed by the active contract, document, clause, and obligation data."
      >
        <SpatialWorkspace contract={contract} documents={documents} analysisRun={analysisRun} clauses={clauses} obligations={obligations} />

        <div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-4)" }}>
          <EntityFocus
            title={contract?.title || "Contract"}
            summary="Entity focus reflects live contract metadata and current processing state."
            chips={[
              `Status: ${contract?.status || "unknown"}`,
              `Documents: ${documents.length}`,
            ]}
          />
          <EvidenceInspector items={[]} />
          <ImpactPath steps={[]} />
        </div>

        <div className="op-grid op-grid-2" style={{ marginTop: "var(--op-space-4)" }}>
          <ScenarioBranch title="Scenario placeholders" branches={[]} />
          <Timeline events={[]} />
        </div>
      </SpatialPanel>
    </SpatialInteractionProvider>
  );
}

function SpatialWorkspace({ contract, documents, analysisRun, clauses, obligations }) {
  const {
    state,
    setMode,
    setActiveLayer,
    selectEntity,
    focusEntity,
    hoverEntity,
    inspectTarget,
    expandEntity,
    collapseEntity,
    navigateToContext,
    returnToPreviousContext,
    setContextTransition,
  } = useSpatialInteractionBus();

  const entities = [
    createSpatialEntity({
      id: "contract",
      type: "contract",
      layer: "contract",
      label: contract?.title || "Contract",
      metadata: {
        identity: "Contract object",
        status: contract?.status || "unknown",
        created_at: contract?.created_at ? new Date(contract.created_at).toISOString() : "unknown",
        relationships: ["contains documents", "routes to extraction state"],
        available_actions: "Open analysis, inspect contract status",
        unavailable_layers: "Deadline, risk, recommendation, evidence routes are not exposed in the current backend model",
        availability_state: INTELLIGENCE_AVAILABILITY.AVAILABLE,
      },
    }),
    ...documents.map((doc, index) =>
      createSpatialEntity({
        id: `document-${doc.id || index}`,
        type: "document",
        layer: "contract",
        label: doc?.filename || `Document ${index + 1}`,
        metadata: {
          identity: "Document object",
          status: doc?.status || "none",
          relationships: ["belongs to contract", "processed by extraction state"],
          available_actions: "Inspect document status",
          unavailable_layers: "Clause extraction detail endpoint",
          availability_state: INTELLIGENCE_AVAILABILITY.AVAILABLE,
        },
      })
    ),
    createSpatialEntity({
      id: analysisRun?.id || "analysis",
      type: "analysis",
      layer: "operational",
      label: analysisRun?.status ? `Analysis run · ${analysisRun.status}` : "Active analysis",
      metadata: {
        entity_type: "analysis",
        analysis_run_id: analysisRun?.id || null,
        status: analysisRun?.status || "unknown",
        relationship: "Linked to the active document version and downstream clause/obligation extraction",
        relationships: [
          `Contract -> ${contract?.title || "current contract"}`,
          `Document version -> ${documents[0]?.id || "latest document"}`,
        ],
        available_actions: "Open analysis pipeline, inspect run metadata",
        unavailable_layers: "Deadline, risk, recommendation intelligence",
        availability_state: analysisRun?.id ? INTELLIGENCE_AVAILABILITY.AVAILABLE : INTELLIGENCE_AVAILABILITY.EMPTY,
      },
    }),
    ...clauses.map((clause) =>
      createSpatialEntity({
        id: clause.id,
        type: "clause",
        layer: "contract",
        label: clause.clause_number || clause.title || "Clause",
        metadata: {
          entity_type: "clause",
          clause_number: clause.clause_number || null,
          title: clause.title || null,
          category: clause.category || null,
          subtype: clause.subtype || null,
          source_text: clause.source_text || null,
          confidence: clause.confidence ?? null,
          review_status: clause.review_status || null,
          parent_relationship: "Belongs to the active analysis run and its source document version",
          relationships: [
            `analysis_run: ${analysisRun?.id || "not available"}`,
            clause.parent_clause_id ? `parent_clause: ${clause.parent_clause_id}` : "parent_clause: none",
          ],
          available_actions: "Inspect clause context",
          unavailable_layers: "No downstream recommendation or risk intelligence is exposed for this clause",
          availability_state: INTELLIGENCE_AVAILABILITY.AVAILABLE,
        },
      })
    ),
    ...obligations.map((obligation) =>
      createSpatialEntity({
        id: obligation.id,
        type: "obligation",
        layer: "contract",
        label: obligation.description || obligation.obligation_type || "Obligation",
        metadata: {
          entity_type: "obligation",
          obligation_type: obligation.obligation_type || null,
          description: obligation.description || null,
          trigger_expression: obligation.trigger_expression || null,
          conditionality: obligation.conditionality || null,
          frequency: obligation.frequency || null,
          priority: obligation.priority || null,
          status: obligation.status || null,
          confidence: obligation.confidence ?? null,
          review_status: obligation.review_status || null,
          clause_id: obligation.clause_id || null,
          parent_relationship: obligation.clause_id ? `Derived from clause ${obligation.clause_id}` : "No related clause is exposed",
          relationships: [
            `analysis_run: ${analysisRun?.id || "not available"}`,
            obligation.clause_id ? `clause: ${obligation.clause_id}` : "clause: none",
          ],
          available_actions: "Inspect obligation context",
          unavailable_layers: "Deadline intelligence is intentionally not exposed by the current backend contract",
          availability_state: INTELLIGENCE_AVAILABILITY.AVAILABLE,
        },
      })
    ),
  ];

  const edges = [
    ...documents.map((doc, index) => {
      const id = `document-${doc.id || index}`;
      return createSpatialEdge({ from: "contract", to: id, relation: "contains" });
    }),
    ...documents.map((doc, index) => {
      const id = `document-${doc.id || index}`;
      return createSpatialEdge({ from: id, to: analysisRun?.id || "analysis", relation: "processed_by" });
    }),
    ...(analysisRun?.id ? [createSpatialEdge({ from: analysisRun.id, to: "analysis", relation: "reflects" })] : []),
    ...clauses.map((clause) => createSpatialEdge({ from: analysisRun?.id || "analysis", to: clause.id, relation: "contains" })),
    ...obligations.map((obligation) => createSpatialEdge({ from: obligation.clause_id || analysisRun?.id || "analysis", to: obligation.id, relation: obligation.clause_id ? "originates_from" : "part_of" })),
  ];

  const breadcrumbItems = [
    { id: "workspace", label: "Workspace" },
    ...state.navigationHistory.map((entry, index) => ({ id: `history-${index}`, label: entry?.label || `Step ${index + 1}` })),
  ];

  function onEntitySelect(entity) {
    selectEntity(entity.id);
    focusEntity(entity.id);
    inspectTarget(entity);
    navigateToContext({ id: entity.id, label: entity.label }, "navigate");
  }

  function handleReturn() {
    const previous = state.navigationHistory[state.navigationHistory.length - 2];
    returnToPreviousContext();
    if (previous) {
      inspectTarget({
        id: previous.id,
        label: previous.label,
        metadata: {
          source: "history_return",
          note: "Returned to previous context without resetting workspace.",
        },
      });
    }
  }

  function onStageSelect(stage) {
    setActiveLayer(stage.id === "analysis" ? "operational" : "contract");
    setContextTransition("layer");
    if (stage.availability === INTELLIGENCE_AVAILABILITY.AVAILABLE) {
      const entity =
        stage.id === "document"
          ? entities.find((item) => item.type === "document")
          : entities.find((item) => item.id === stage.id);
      if (entity) {
        onEntitySelect(entity);
        return;
      }
      inspectTarget({
        id: stage.id,
        label: stage.label,
        metadata: {
          availability_state: INTELLIGENCE_AVAILABILITY.EMPTY,
          note: "This layer is connected but currently has no records.",
        },
      });
      return;
    }
    const hierarchyNode = CONTRACT_INTELLIGENCE_HIERARCHY.find((node) => node.id === stage.id);
    inspectTarget({
      id: stage.id,
      label: stage.label,
      metadata: {
        entity_type: hierarchyNode?.type || stage.id,
        parent_relationship: hierarchyNode?.parent ? `Belongs to ${hierarchyNode.parent}` : "Contract root layer",
        availability_state: INTELLIGENCE_AVAILABILITY.UNAVAILABLE,
        note: "No frontend read endpoint currently provides this stage.",
      },
    });
  }

  return (
    <div className="op-stack" style={{ gap: "var(--op-space-4)" }}>
      <div className="op-row" style={{ flexWrap: "wrap" }}>
        <SpatialModeToggle mode={state.mode} onChange={setMode} />
        <div className="op-row" style={{ gap: "var(--op-space-2)", justifyContent: "flex-end" }}>
          <button type="button" className="op-btn op-btn-quiet" onClick={handleReturn}>
            Return
          </button>
        </div>
      </div>

      <SpatialBreadcrumb
        items={breadcrumbItems}
        onNavigate={(item, index) => {
          if (index === breadcrumbItems.length - 1) return;
          handleReturn();
          inspectTarget({ id: item.id, label: item.label, metadata: { source: "breadcrumb" } });
        }}
      />

      <SpatialStage
        stages={WORKSPACE_STAGES}
        activeStageId={state.selectedEntityId || "contract"}
        onSelectStage={onStageSelect}
      />

      {state.mode === "standard" ? (
        <SpatialTransition kind="enter">
          <div className="op-flow-shell">
            <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)" }}>
              <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Standard view</p>
              <div className="op-list-table">
                {entities.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    className={[
                      "op-list-row",
                      state.selectedEntityId === entity.id ? "op-list-row-selected" : "",
                    ].join(" ").trim()}
                    onClick={() => onEntitySelect(entity)}
                    onMouseEnter={() => hoverEntity(entity.id)}
                    onMouseLeave={() => hoverEntity(null)}
                  >
                    <span className="op-body-sm">{entity.label}</span>
                    <span className="op-badge">{entity.type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="op-flow-rail">
              <SpatialFocus
                focusedLabel={state.focusedEntityId || state.selectedEntityId}
                contextLabel={state.hoveredEntityId ? `Hover: ${state.hoveredEntityId}` : "Contract dependency context"}
              />
              <SpatialInspectorBridge emptyMessage="Select an intelligence layer to inspect contract, document, clause, obligation, deadline, risk, evidence, or recommendation context." />
            </div>
          </div>
        </SpatialTransition>
      ) : (
        <SpatialTransition kind="navigate" className="op-transition-shell">
          <div className="op-grid op-grid-2">
            <SpatialViewport title="Spatial viewport">
              <SpatialCanvas
                entities={entities}
                edges={edges}
                state={state}
                onEntitySelect={onEntitySelect}
                onEntityFocus={(entity) => focusEntity(entity.id)}
                onEntityHover={hoverEntity}
                onEntityInspect={inspectTarget}
                onExpand={expandEntity}
                onCollapse={collapseEntity}
              />
            </SpatialViewport>
            <div className="op-stack">
              <SpatialLayerManager layers={SPATIAL_LAYERS} />
              <SpatialFocus
                focusedLabel={state.focusedEntityId || state.selectedEntityId}
                contextLabel={state.hoveredEntityId ? `Hover: ${state.hoveredEntityId}` : "Contract dependency context"}
              />
              <SpatialInspectorBridge emptyMessage="Select an intelligence layer to inspect contract, document, clause, obligation, deadline, risk, evidence, or recommendation context." />
            </div>
          </div>
        </SpatialTransition>
      )}
    </div>
  );
}

function SpatialCanvas({
  entities,
  edges,
  state,
  onEntitySelect,
  onEntityFocus,
  onEntityHover,
  onEntityInspect,
  onExpand,
  onCollapse,
}) {
  const hidden = new Set(state.hiddenLayerIds || []);
  const unavailableTargets = new Set(["clauses", "obligations", "deadlines", "risks", "evidence", "recommendations"]);

  return (
    <div className="op-stack" style={{ gap: "var(--op-space-3)" }}>
      <p className="op-body-sm">
        Spatial mode visualizes connected, real entities. Unavailable nodes are
        represented as explicit boundaries rather than fabricated values.
      </p>

      <div className="op-entity-grid">
        {entities
          .filter((entity) => !hidden.has(entity.layer))
          .map((entity) => (
            <SpatialEntity
              key={entity.id}
              entity={entity}
              selected={state.selectedEntityId === entity.id}
              focused={state.focusedEntityId === entity.id}
              expanded={state.expandedEntityIds.includes(entity.id)}
              onSelect={onEntitySelect}
              onFocus={onEntityFocus}
              onHover={onEntityHover}
              onInspect={onEntityInspect}
              onExpand={onExpand}
              onCollapse={onCollapse}
            />
          ))}
      </div>

      <div className="op-surface" style={{ padding: "var(--op-space-3)" }}>
        <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Connections</p>
        {edges.map((edge) => (
          <SpatialConnection
            key={edge.id}
            from={edge.from}
            to={edge.to}
            relation={edge.relation}
            unavailable={unavailableTargets.has(edge.to)}
          />
        ))}
      </div>
    </div>
  );
}
