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

  function recordsById(records) {
    return new Map(records.map((record) => [record.id, record]));
  }

  function changedRecordIds(previousRecords, nextRecords) {
    const previous = recordsById(previousRecords);
    return nextRecords
      .filter((record) => previous.has(record.id) && JSON.stringify(previous.get(record.id)) !== JSON.stringify(record))
      .map((record) => record.id);
  }

  function recordChanges(previousRecords, nextRecords) {
    const previousIds = new Set(previousRecords.map((record) => record.id));
    const nextIds = new Set(nextRecords.map((record) => record.id));
    return {
      added: nextRecords.filter((record) => !previousIds.has(record.id)).map((record) => record.id),
      removed: previousRecords.filter((record) => !nextIds.has(record.id)).map((record) => record.id),
      updated: changedRecordIds(previousRecords, nextRecords)
    };
  }

  function positionNewEntities(positions, entities) {
    const unpositioned = entities.filter((entity) => !positions[entity.id]);
    if (unpositioned.length === 0) return positions;

    const positioned = entities.filter((entity) => positions[entity.id]);
    const bottom = positioned.reduce((maximum, entity) => (
      Math.max(maximum, positions[entity.id].y + tableHeight(entity))
    ), 0);
    const margin = 48;
    const startY = positioned.length === 0 ? margin : bottom + 80;
    const addedPositions = layoutEntities(unpositioned, { margin });

    unpositioned.forEach((entity) => {
      positions[entity.id] = {
        x: addedPositions[entity.id].x,
        y: addedPositions[entity.id].y - margin + startY
      };
    });
    return positions;
  }

  function reconcileState(state, previousSchema, nextSchema) {
    const previousEntityIds = new Set(previousSchema.entities.map((entity) => entity.id));
    const nextEntityIds = new Set(nextSchema.entities.map((entity) => entity.id));
    const positions = positionNewEntities(
      Object.fromEntries(Object.entries(state.positions).map(([id, position]) => [id, { ...position }])),
      nextSchema.entities
    );

    return {
      state: {
        ...state,
        includedEntityIds: state.includedEntityIds.filter((id) => previousEntityIds.has(id) && nextEntityIds.has(id)),
        positions,
        notes: state.notes.map((note) => ({ ...note }))
      },
      changes: {
        entities: recordChanges(previousSchema.entities, nextSchema.entities),
        relationships: recordChanges(previousSchema.relationships, nextSchema.relationships),
        specializations: recordChanges(previousSchema.specializations, nextSchema.specializations)
      }
    };
  }

  function changeSummary(changes) {
    const parts = [];
    const entityChanges = changes.entities;
    const relationshipChanges = changes.relationships;
    const specializationChanges = changes.specializations;

    if (entityChanges.added.length > 0) parts.push(`${entityChanges.added.length} added`);
    if (entityChanges.updated.length > 0) parts.push(`${entityChanges.updated.length} updated`);
    if (entityChanges.removed.length > 0) {
      parts.push(`${entityChanges.removed.length} removed (${entityChanges.removed.join(", ")})`);
    }

    const connectionCount = [relationshipChanges, specializationChanges].reduce((total, records) => (
      total + records.added.length + records.updated.length + records.removed.length
    ), 0);
    if (connectionCount > 0) {
      parts.push(`${connectionCount} relationship ${connectionCount === 1 ? "change" : "changes"}`);
    }

    return parts.length === 0 ? "Schema refreshed: no changes." : `Schema refreshed: ${parts.join(", ")}.`;
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

  function panViewport(transform, deltaX, deltaY) {
    const nextTransform = [...transform];
    nextTransform[4] -= deltaX;
    nextTransform[5] -= deltaY;
    return nextTransform;
  }

  return {
    CARD_WIDTH,
    HEADER_HEIGHT,
    ROW_HEIGHT,
    topLeft,
    tableHeight,
    layoutEntities,
    createState,
    reconcileState,
    changeSummary,
    setEntityIncluded,
    visibleRelationships,
    cardinalityLabel,
    fitViewport,
    panViewport
  };
});
