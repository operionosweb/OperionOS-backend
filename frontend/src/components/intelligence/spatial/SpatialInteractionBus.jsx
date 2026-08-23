import React, { createContext, useContext, useMemo, useReducer } from "react";

const SpatialInteractionContext = createContext(null);

const initialState = {
  mode: "standard",
  selectedEntityId: null,
  focusedEntityId: null,
  hoveredEntityId: null,
  isolatedEntityIds: [],
  comparedEntityIds: [],
  activeLayerId: "operational",
  hiddenLayerIds: [],
  expandedEntityIds: [],
  navigationHistory: [],
  viewport: { zoom: 1, x: 0, y: 0 },
  contextTransition: null,
  inspectionTarget: null,
  lastAction: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "mode":
      return { ...state, mode: action.mode === "spatial" ? "spatial" : "standard", lastAction: "mode" };
    case "select":
      return { ...state, selectedEntityId: action.entityId || null, lastAction: "select" };
    case "focus":
      return { ...state, focusedEntityId: action.entityId || null, lastAction: "focus" };
    case "hover":
      return { ...state, hoveredEntityId: action.entityId || null, lastAction: "hover" };
    case "isolate":
      return { ...state, isolatedEntityIds: action.entityIds || [], lastAction: "isolate" };
    case "compare":
      return { ...state, comparedEntityIds: action.entityIds || [], lastAction: "compare" };
    case "layer":
      return { ...state, activeLayerId: action.layerId || "operational", lastAction: "layer" };
    case "layerVisibility": {
      const next = state.hiddenLayerIds.includes(action.layerId)
        ? state.hiddenLayerIds.filter((id) => id !== action.layerId)
        : [...state.hiddenLayerIds, action.layerId];
      return { ...state, hiddenLayerIds: next, lastAction: "layerVisibility" };
    }
    case "expand": {
      if (state.expandedEntityIds.includes(action.entityId)) return state;
      return { ...state, expandedEntityIds: [...state.expandedEntityIds, action.entityId], lastAction: "expand" };
    }
    case "collapse": {
      return {
        ...state,
        expandedEntityIds: state.expandedEntityIds.filter((id) => id !== action.entityId),
        lastAction: "collapse",
      };
    }
    case "viewport":
      return { ...state, viewport: { ...state.viewport, ...(action.viewport || {}) }, lastAction: "navigate" };
    case "inspect":
      return { ...state, inspectionTarget: action.target || null, lastAction: "inspect" };
    case "transition":
      return { ...state, contextTransition: action.transition || null, lastAction: "transition" };
    case "navigate":
      return {
        ...state,
        navigationHistory: [...state.navigationHistory, action.target],
        contextTransition: action.transition || null,
        lastAction: "navigate",
      };
    case "return": {
      if (!state.navigationHistory.length) return state;
      return {
        ...state,
        navigationHistory: state.navigationHistory.slice(0, -1),
        contextTransition: "return",
        lastAction: "return",
      };
    }
    default:
      return state;
  }
}

export function SpatialInteractionProvider({ children, value }) {
  const [state, dispatch] = useReducer(reducer, { ...initialState, ...(value || {}) });

  const api = useMemo(
    () => ({
      state,
      setMode: (mode) => dispatch({ type: "mode", mode }),
      selectEntity: (entityId) => dispatch({ type: "select", entityId }),
      focusEntity: (entityId) => dispatch({ type: "focus", entityId }),
      hoverEntity: (entityId) => dispatch({ type: "hover", entityId }),
      isolateEntities: (entityIds) => dispatch({ type: "isolate", entityIds }),
      compareEntities: (entityIds) => dispatch({ type: "compare", entityIds }),
      setActiveLayer: (layerId) => dispatch({ type: "layer", layerId }),
      toggleLayerVisibility: (layerId) => dispatch({ type: "layerVisibility", layerId }),
      expandEntity: (entityId) => dispatch({ type: "expand", entityId }),
      collapseEntity: (entityId) => dispatch({ type: "collapse", entityId }),
      setViewport: (viewport) => dispatch({ type: "viewport", viewport }),
      inspectTarget: (target) => dispatch({ type: "inspect", target }),
      setContextTransition: (transition) => dispatch({ type: "transition", transition }),
      navigateToContext: (target, transition) => dispatch({ type: "navigate", target, transition }),
      returnToPreviousContext: () => dispatch({ type: "return" }),
    }),
    [state]
  );

  return (
    <SpatialInteractionContext.Provider value={api}>
      {children}
    </SpatialInteractionContext.Provider>
  );
}

export function useSpatialInteractionBus() {
  const context = useContext(SpatialInteractionContext);
  if (!context) throw new Error("useSpatialInteractionBus must be used within SpatialInteractionProvider");
  return context;
}
