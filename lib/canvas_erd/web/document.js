(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CanvasERDDocument = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const CARD_WIDTH = 300;
  const HEADER_HEIGHT = 58;
  const ROW_HEIGHT = 23;
  const CARD_PADDING = 10;

  function topLeft(options = {}) {
    return {
      originX: "left",
      originY: "top",
      ...options
    };
  }

  function tableHeight(entity) {
    const rows = Math.max(entity.attributes.length, 1);
    return HEADER_HEIGHT + rows * ROW_HEIGHT + CARD_PADDING;
  }

  function layoutEntities(entities, options = {}) {
    const margin = options.margin || 48;
    const gapX = options.gapX || 90;
    const gapY = options.gapY || 80;
    const columns = options.columns || Math.max(1, Math.ceil(Math.sqrt(entities.length)));
    const sorted = [...entities].sort((first, second) => first.id.localeCompare(second.id));
    const positions = {};
    let y = margin;

    for (let index = 0; index < sorted.length; index += columns) {
      const row = sorted.slice(index, index + columns);
      const rowHeight = Math.max(...row.map(tableHeight));

      row.forEach((entity, column) => {
        positions[entity.id] = {
          x: margin + column * (CARD_WIDTH + gapX),
          y
        };
      });
      y += rowHeight + gapY;
    }

    return positions;
  }

  function createState(schema) {
    return {
      includedEntityIds: schema.entities.map((entity) => entity.id),
      positions: layoutEntities(schema.entities),
      notes: []
    };
  }

  function setEntityIncluded(state, entityId, included) {
    const ids = new Set(state.includedEntityIds);
    if (included) ids.add(entityId);
    else ids.delete(entityId);

    return {
      ...state,
      includedEntityIds: [...ids]
    };
  }

  function visibleRelationships(schema, includedEntityIds) {
    const included = new Set(includedEntityIds);
    return schema.relationships.filter((relationship) => (
      included.has(relationship.source_id) && included.has(relationship.destination_id)
    ));
  }

  function rangeLabel(range) {
    if (range.maximum === null) return `${range.minimum}..*`;
    if (range.minimum === range.maximum) return String(range.minimum);
    return `${range.minimum}..${range.maximum}`;
  }

  function cardinalityLabel(relationship) {
    return `${rangeLabel(relationship.cardinality.source)} — ${rangeLabel(relationship.cardinality.destination)}`;
  }

  function fitViewport(bounds, viewport, padding = 64, maximumZoom = 1) {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return [1, 0, 0, 1, 0, 0];

    const availableWidth = Math.max(1, viewport.width - padding * 2);
    const availableHeight = Math.max(1, viewport.height - padding * 2);
    const zoom = Math.min(maximumZoom, availableWidth / bounds.width, availableHeight / bounds.height);
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    return [
      zoom,
      0,
      0,
      zoom,
      viewport.width / 2 - centerX * zoom,
      viewport.height / 2 - centerY * zoom
    ];
  }

  return {
    CARD_WIDTH,
    HEADER_HEIGHT,
    ROW_HEIGHT,
    topLeft,
    tableHeight,
    layoutEntities,
    createState,
    setEntityIncluded,
    visibleRelationships,
    cardinalityLabel,
    fitViewport
  };
});
