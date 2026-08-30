(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CanvasERDLayout = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const MARGIN = 48;
  const LAYOUT_OPTIONS = Object.freeze({
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    "elk.padding": `[top=${MARGIN},left=${MARGIN},bottom=${MARGIN},right=${MARGIN}]`,
    "spacing.baseValue": 40,
    "elk.layered.nodePlacement.bk.fixedAlignment": "NONE",
    "elk.layered.unnecessaryBendpoints": true,
    "elk.layered.wrapping.multiEdge.improveCuts": true,
    "elk.layered.wrapping.multiEdge.improveWrappedEdges": true,
    "elk.layered.edgeRouting.selfLoopDistribution": "EQUALLY"
  });

  function graphFor(schema, dimensions) {
    const entityIds = new Set(schema.entities.map((entity) => entity.id));
    return {
      id: "root",
      layoutOptions: { ...LAYOUT_OPTIONS },
      children: schema.entities.map((entity) => ({
        id: entity.id,
        width: dimensions.width(entity),
        height: dimensions.height(entity)
      })),
      edges: schema.relationships
        .filter((relationship) => (
          entityIds.has(relationship.source_id) && entityIds.has(relationship.destination_id)
        ))
        .map((relationship, index) => ({
          id: `relationship-${index}`,
          sources: [relationship.source_id],
          targets: [relationship.destination_id]
        }))
    };
  }

  function schemaForEntityIds(schema, entityIds) {
    const included = new Set(entityIds);
    return {
      ...schema,
      entities: schema.entities.filter((entity) => included.has(entity.id)),
      relationships: schema.relationships.filter((relationship) => (
        included.has(relationship.source_id) && included.has(relationship.destination_id)
      ))
    };
  }

  function positionsFrom(graph) {
    const children = graph.children || [];
    if (children.length === 0) return {};
    if (children.some((child) => !Number.isFinite(child.x) || !Number.isFinite(child.y))) {
      throw new Error("ELK returned a node without a position");
    }

    const minimumX = Math.min(...children.map((child) => child.x));
    const minimumY = Math.min(...children.map((child) => child.y));
    return Object.fromEntries(children.map((child) => [
      child.id,
      { x: child.x - minimumX + MARGIN, y: child.y - minimumY + MARGIN }
    ]));
  }

  async function layoutEntities(schema, engine, dimensions) {
    return positionsFrom(await engine.layout(graphFor(schema, dimensions)));
  }

  return { MARGIN, LAYOUT_OPTIONS, graphFor, schemaForEntityIds, positionsFrom, layoutEntities };
});
