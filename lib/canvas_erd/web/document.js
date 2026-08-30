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
  const CANVAS_FONT_FAMILY = "Arial";

  function topLeft(options = {}) {
    return {
      originX: "left",
      originY: "top",
      ...options
    };
  }

  function uncachedText(options = {}) {
    return topLeft({ ...options, objectCaching: false });
  }

  function paddedBackgroundBounds(width, height, padding) {
    return {
      left: -width / 2 - padding,
      top: -height / 2 - padding,
      width: width + padding * 2,
      height: height + padding * 2
    };
  }

  function erdFilename(value) {
    const basename = String(value).trim().replace(/(?:\.erd)?\.png$/i, "");
    return `${basename || "diagram"}.erd.png`;
  }

  function diagramName(value) {
    const name = String(value || "").trim().replace(/(?:\.erd)?\.png$/i, "");
    return name || "Untitled ERD";
  }

  function confirmDiscardChanges(dirty, confirmDiscard) {
    return !dirty || confirmDiscard("Discard unsaved changes to this diagram?");
  }

  function shortcutAction(event) {
    const key = String(event.key).toLowerCase();
    const command = event.metaKey || event.ctrlKey;
    if (event.altKey) return null;

    if (command) {
      return { s: "save", o: "open", n: "new" }[key] || null;
    }

    return {
      n: "addNote",
      a: "arrow",
      t: "toggleTables",
      "+": "zoomIn",
      "=": "zoomIn",
      "-": "zoomOut",
      "0": "fit",
      "?": "help"
    }[key] || null;
  }

  function isSaveShortcut(event) {
    return shortcutAction(event) === "save";
  }

  function selectedDiagramFilename(filename, availableFilenames) {
    return filename && availableFilenames.includes(filename) ? filename : "";
  }

  function notePositionAt(point) {
    return { x: point.x - 110, y: point.y - 45 };
  }

  function snapPointToBounds(point, bounds) {
    const right = bounds.left + bounds.width;
    const bottom = bounds.top + bounds.height;
    let x = Math.min(right, Math.max(bounds.left, point.x));
    let y = Math.min(bottom, Math.max(bounds.top, point.y));
    const edges = [
      { distance: Math.abs(point.x - bounds.left), apply: () => { x = bounds.left; } },
      { distance: Math.abs(point.x - right), apply: () => { x = right; } },
      { distance: Math.abs(point.y - bounds.top), apply: () => { y = bounds.top; } },
      { distance: Math.abs(point.y - bottom), apply: () => { y = bottom; } }
    ];
    edges.reduce((nearest, edge) => edge.distance < nearest.distance ? edge : nearest).apply();

    return {
      point: { x, y },
      anchor: {
        x: bounds.width === 0 ? 0 : (x - bounds.left) / bounds.width,
        y: bounds.height === 0 ? 0 : (y - bounds.top) / bounds.height
      }
    };
  }

  function pointAtAnchor(bounds, anchor) {
    return {
      x: bounds.left + bounds.width * anchor.x,
      y: bounds.top + bounds.height * anchor.y
    };
  }

  function transformedArrowEndpoints(points, transform) {
    const apply = (x, y) => ({
      x: transform[0] * x + transform[2] * y + transform[4],
      y: transform[1] * x + transform[3] * y + transform[5]
    });
    return {
      start: apply(points.x1, points.y1),
      end: apply(points.x2, points.y2)
    };
  }

  function createChangeTracker(onChange = () => {}) {
    let dirty = false;

    return {
      markDirty() {
        if (dirty) return;
        dirty = true;
        onChange(dirty);
      },
      markClean() {
        if (!dirty) return;
        dirty = false;
        onChange(dirty);
      },
      isDirty() {
        return dirty;
      }
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
      notes: [],
      arrows: []
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
        notes: state.notes.map((note) => ({ ...note })),
        arrows: (state.arrows || []).map((arrow) => ({
          ...arrow,
          start: { ...arrow.start, attachment: arrow.start.attachment ? { ...arrow.start.attachment } : null },
          end: { ...arrow.end, attachment: arrow.end.attachment ? { ...arrow.end.attachment } : null }
        }))
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

  function selectedEntityIds(activeObject) {
    if (!activeObject) return [];
    const objects = activeObject.canvasErdType === "entity"
      ? [activeObject]
      : (typeof activeObject.getObjects === "function" ? activeObject.getObjects() : []);
    return objects
      .filter((object) => object.canvasErdType === "entity")
      .map((object) => object.entityId);
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

  function zoomForWheel(currentZoom, deltaY, minimumZoom = 0.15, maximumZoom = 2.5) {
    return Math.min(maximumZoom, Math.max(minimumZoom, currentZoom * Math.exp(-deltaY * 0.01)));
  }

  function shouldCacheTable(zoom, retinaScaling, maximumEffectiveZoom = 3) {
    return zoom * retinaScaling <= maximumEffectiveZoom;
  }

  function createPanScheduler(apply, schedule = globalThis.requestAnimationFrame) {
    let frame = null;
    let deltaX = 0;
    let deltaY = 0;

    return function schedulePan(nextDeltaX, nextDeltaY) {
      deltaX += nextDeltaX;
      deltaY += nextDeltaY;
      if (frame !== null) return;

      frame = schedule(() => {
        const accumulatedX = deltaX;
        const accumulatedY = deltaY;
        frame = null;
        deltaX = 0;
        deltaY = 0;
        apply(accumulatedX, accumulatedY);
      });
    };
  }

  function createPanQualityController(setRetina, options = {}) {
    const schedule = options.schedule || globalThis.setTimeout;
    const cancel = options.cancel || globalThis.clearTimeout;
    const idleDelay = options.idleDelay || 150;
    let restoreTimer = null;
    let reduced = false;

    function finish() {
      if (restoreTimer !== null) cancel(restoreTimer);
      restoreTimer = null;
      if (!reduced) return;
      reduced = false;
      setRetina(true);
    }

    return {
      begin() {
        if (!reduced) {
          reduced = true;
          setRetina(false);
        }
        if (restoreTimer !== null) cancel(restoreTimer);
        restoreTimer = schedule(finish, idleDelay);
      },
      finish
    };
  }

  return {
    CARD_WIDTH,
    HEADER_HEIGHT,
    ROW_HEIGHT,
    CANVAS_FONT_FAMILY,
    topLeft,
    uncachedText,
    paddedBackgroundBounds,
    erdFilename,
    diagramName,
    confirmDiscardChanges,
    shortcutAction,
    isSaveShortcut,
    selectedDiagramFilename,
    notePositionAt,
    snapPointToBounds,
    pointAtAnchor,
    transformedArrowEndpoints,
    createChangeTracker,
    tableHeight,
    layoutEntities,
    createState,
    reconcileState,
    changeSummary,
    setEntityIncluded,
    selectedEntityIds,
    visibleRelationships,
    cardinalityLabel,
    fitViewport,
    panViewport,
    zoomForWheel,
    shouldCacheTable,
    createPanScheduler,
    createPanQualityController
  };
});
