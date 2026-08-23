# Operion Spatial UX Language

This specification defines the Phase 4.3 interaction grammar for renderer-agnostic spatial intelligence interfaces.

## Depth
- Background layer: ambient context and workspace orientation.
- Mid layer: navigable entities and relationship paths.
- Foreground layer: selected/focused intelligence object.
- Inspector layer: evidence, metadata, and action context.
- Rule: depth must encode hierarchy and relevance, not decoration.

## Focus
- Selecting an entity promotes it to foreground focus.
- Adjacent context de-emphasizes through opacity/contrast, not disappearance.
- Related entities remain available for exploration.
- Inspector updates from selected/focused target.
- Return action restores previous context from navigation history.

## Connection
- Connections represent explicit typed relationships.
- Canonical contract chain:
  Contract -> Document -> Analysis -> Clauses -> Obligations -> Evidence.
- Unavailable nodes remain visible as boundary states without fabricated values.

## Motion
- Enter/exit: context continuity.
- Focus: selected object emphasis.
- Expand/collapse: progressive disclosure.
- Navigate/return: path traversal.
- Layer transition: perspective shift.
- Inspector transition: detail update.
- Reduced-motion: semantic information remains, transitions minimized.

## Standard + Spatial Duality
- Standard mode is the default operational representation.
- Spatial mode provides exploratory relationship navigation.
- Both modes consume shared interaction state and identity semantics.
- Neither mode is allowed to hide critical information from the other.

## Renderer Agnosticism
The interaction/state model is intentionally renderer independent and can be consumed by:
- DOM/CSS
- SVG
- Canvas
- WebGL
- future WebXR
