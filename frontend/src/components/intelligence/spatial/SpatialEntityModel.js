export function createSpatialEntity(input) {
  return {
    id: String(input.id),
    type: input.type || "entity",
    layer: input.layer || "operational",
    label: input.label || String(input.id),
    metadata: input.metadata || {},
  };
}

export function createSpatialEdge(input) {
  return {
    id: input.id || `${input.from}->${input.to}`,
    from: String(input.from),
    to: String(input.to),
    relation: input.relation || "related",
    confidence: typeof input.confidence === "number" ? input.confidence : null,
    metadata: input.metadata || {},
  };
}

export function groupSpatialEntitiesByType(entities = []) {
  return entities.reduce((accumulator, entity) => {
    const key = entity.type || "entity";
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push(entity);
    return accumulator;
  }, {});
}
