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
  const NOTE_PADDING = 12;
  const CANVAS_FONT_FAMILY = "Arial";
  const DEFAULT_BACKGROUND_COLORS = Object.freeze([
    "#dbeafe", "#fee2e2", "#ffedd5", "#fff2a8", "#dcfce7",
    "#cffafe", "#ede9fe", "#f3f4f6"
  ]);
  const DEFAULT_FOREGROUND_COLORS = Object.freeze([
    "#243b63", "#7f1d1d", "#9a3412", "#854d0e", "#166534",
    "#155e75", "#6b21a8", "#374151"
  ]);
  const NOTE_PARAGRAPH_STYLES = Object.freeze({
    title: Object.freeze({ fontFamily: "Georgia", fontSize: 32, fontWeight: "bold", lineHeight: 1.15 }),
    heading: Object.freeze({ fontFamily: "Georgia", fontSize: 22, fontWeight: "bold", lineHeight: 1.15 }),
    paragraph: Object.freeze({ fontFamily: "Arial", fontSize: 15, fontWeight: "normal", lineHeight: 1.25 }),
    code: Object.freeze({ fontFamily: "Courier New", fontSize: 14, fontWeight: "normal", lineHeight: 1.2 })
  });
  const CODE_FONT_SIZES = Object.freeze({ small: 12, medium: 14, large: 18 });
  const DEFAULT_TABLE_HEADER_COLOR = "#243b63";
  const DEFAULT_TABLE_HEADER_COLORS = DEFAULT_FOREGROUND_COLORS;
  const DEFAULT_ARROW_FORMATTING = Object.freeze({
    color: DEFAULT_FOREGROUND_COLORS[0],
    strokeWidth: 2.25,
    lineStyle: "solid",
    startHead: "none",
    endHead: "filled"
  });
  const DEFAULT_FRAME_FORMATTING = Object.freeze({
    color: DEFAULT_FOREGROUND_COLORS[0],
    lineStyle: "solid"
  });
  const DEFAULT_NOTE_FORMATTING = Object.freeze({
    paragraphStyle: "paragraph",
    ...NOTE_PARAGRAPH_STYLES.paragraph,
    fontStyle: "normal",
    underline: false,
    fill: "#374151",
    backgroundColor: "#fff2a8",
    textAlign: "left"
  });

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

  function noteSelectionPadding(zoom) {
    return NOTE_PADDING * zoom;
  }

  function noteFormatting(note = {}) {
    const paragraphStyle = noteParagraphStyle(note);
    const style = NOTE_PARAGRAPH_STYLES[paragraphStyle];
    return {
      paragraphStyle,
      fontWeight: ["normal", "bold"].includes(note.fontWeight) ? note.fontWeight : style.fontWeight,
      fontStyle: note.fontStyle === "italic" ? "italic" : DEFAULT_NOTE_FORMATTING.fontStyle,
      underline: note.underline === true,
      fill: typeof note.fill === "string" ? note.fill : DEFAULT_NOTE_FORMATTING.fill,
      backgroundColor: typeof note.backgroundColor === "string"
        ? note.backgroundColor
        : DEFAULT_NOTE_FORMATTING.backgroundColor,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      textAlign: ["left", "center", "right"].includes(note.textAlign)
        ? note.textAlign
        : DEFAULT_NOTE_FORMATTING.textAlign
    };
  }

  function noteParagraphStyle(note = {}) {
    if (NOTE_PARAGRAPH_STYLES[note.paragraphStyle]) return note.paragraphStyle;
    if (note.fontFamily === "Courier New") return "code";
    if (["Georgia", "Times New Roman"].includes(note.fontFamily)) {
      return note.fontSize >= 28 ? "title" : "heading";
    }
    return "paragraph";
  }

  function noteParagraphStyleFormatting(paragraphStyle) {
    const resolved = NOTE_PARAGRAPH_STYLES[paragraphStyle] ? paragraphStyle : "paragraph";
    return { paragraphStyle: resolved, ...NOTE_PARAGRAPH_STYLES[resolved] };
  }

  function inheritedNoteFormatting(note) {
    return { ...noteFormatting(note || {}) };
  }

  function noteColorSwatches(notes, property, defaults) {
    const colors = [...defaults];
    notes.forEach((note) => {
      const color = note[property];
      if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) return;
      const normalized = color.toLowerCase();
      if (!colors.includes(normalized)) colors.push(normalized);
    });
    return colors;
  }

  function colorPaletteSections(colors, defaults) {
    return {
      defaults: colors.slice(0, defaults.length),
      custom: colors.slice(defaults.length)
    };
  }

  function noteBorderColor(backgroundColor) {
    if (backgroundColor === "transparent") return "#94a3b8";
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(backgroundColor);
    if (!match) return "#94a3b8";

    const channels = match.slice(1).map((channel) => parseInt(channel, 16));
    const luminance = channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114;
    const target = luminance > 150 ? 0 : 255;
    const mixed = channels.map((channel) => Math.round(channel * 0.7 + target * 0.3));
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }

  function tableHeaderColor(state, entityId) {
    return state.tableHeaderColors?.[entityId] || DEFAULT_TABLE_HEADER_COLOR;
  }

  function setTableHeaderColor(state, entityIds, color) {
    const tableHeaderColors = { ...(state.tableHeaderColors || {}) };
    entityIds.forEach((entityId) => {
      if (color === DEFAULT_TABLE_HEADER_COLOR) delete tableHeaderColors[entityId];
      else tableHeaderColors[entityId] = color;
    });
    return { ...state, tableHeaderColors };
  }

  function tableHeaderColorSwatches(tableHeaderColors = {}) {
    const colors = [...DEFAULT_TABLE_HEADER_COLORS];
    Object.values(tableHeaderColors).forEach((color) => {
      if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) return;
      const normalized = color.toLowerCase();
      if (!colors.includes(normalized)) colors.push(normalized);
    });
    return colors;
  }

  function selectedTableHeaderColor(state, entityIds) {
    if (entityIds.length === 0) return null;
    const colors = entityIds.map((entityId) => tableHeaderColor(state, entityId));
    return colors.every((color) => color === colors[0]) ? colors[0] : null;
  }

  function arrowFormatting(arrow = {}) {
    const strokeWidth = Number(arrow.strokeWidth);
    const headStyles = [
      "none", "filled", "open", "circle", "circle-open", "diamond", "diamond-open"
    ];
    return {
      color: typeof arrow.color === "string" ? arrow.color : DEFAULT_ARROW_FORMATTING.color,
      strokeWidth: Number.isFinite(strokeWidth)
        ? Math.min(20, Math.max(0.5, strokeWidth))
        : DEFAULT_ARROW_FORMATTING.strokeWidth,
      lineStyle: ["solid", "dashed", "dotted"].includes(arrow.lineStyle)
        ? arrow.lineStyle
        : DEFAULT_ARROW_FORMATTING.lineStyle,
      startHead: headStyles.includes(arrow.startHead)
        ? arrow.startHead
        : DEFAULT_ARROW_FORMATTING.startHead,
      endHead: headStyles.includes(arrow.endHead)
        ? arrow.endHead
        : DEFAULT_ARROW_FORMATTING.endHead
    };
  }

  function arrowStrokeDashArray(lineStyle) {
    return { dashed: [10, 7], dotted: [2, 6] }[lineStyle] || null;
  }

  function arrowHeadGeometry(style, strokeWidth) {
    const width = arrowFormatting({ strokeWidth }).strokeWidth;
    const length = 10 + width * 1.5;
    const halfWidth = 5 + width;
    const radius = halfWidth * 0.72;
    return {
      length,
      halfWidth,
      radius,
      shaftInset: style === "circle-open" ? radius * 2 : (style === "diamond-open" ? length : 0)
    };
  }

  function shortenedArrowLinePoints(points, startHead, endHead, strokeWidth) {
    const x = points.x2 - points.x1;
    const y = points.y2 - points.y1;
    const distance = Math.hypot(x, y);
    if (distance === 0) return { ...points };

    const startInset = arrowHeadGeometry(startHead, strokeWidth).shaftInset;
    const endInset = arrowHeadGeometry(endHead, strokeWidth).shaftInset;
    const scale = startInset + endInset > distance ? distance / (startInset + endInset) : 1;
    const unitX = x / distance;
    const unitY = y / distance;
    return {
      x1: points.x1 + unitX * startInset * scale,
      y1: points.y1 + unitY * startInset * scale,
      x2: points.x2 - unitX * endInset * scale,
      y2: points.y2 - unitY * endInset * scale
    };
  }

  function arrowColorSwatches(arrows = []) {
    const colors = [...DEFAULT_FOREGROUND_COLORS];
    arrows.forEach((arrow) => {
      const color = arrowFormatting(arrow).color;
      if (!/^#[0-9a-f]{6}$/i.test(color)) return;
      const normalized = color.toLowerCase();
      if (!colors.includes(normalized)) colors.push(normalized);
    });
    return colors;
  }

  function frameFormatting(frame = {}) {
    return {
      color: typeof frame.color === "string" ? frame.color : DEFAULT_FRAME_FORMATTING.color,
      lineStyle: ["solid", "dashed", "dotted"].includes(frame.lineStyle)
        ? frame.lineStyle
        : DEFAULT_FRAME_FORMATTING.lineStyle
    };
  }

  function frameColorSwatches(frames = []) {
    const colors = [...DEFAULT_FOREGROUND_COLORS];
    frames.forEach((frame) => {
      const color = frameFormatting(frame).color;
      if (!/^#[0-9a-f]{6}$/i.test(color)) return;
      const normalized = color.toLowerCase();
      if (!colors.includes(normalized)) colors.push(normalized);
    });
    return colors;
  }

  function frameBounds(first, second) {
    return {
      x: Math.min(first.x, second.x),
      y: Math.min(first.y, second.y),
      width: Math.abs(second.x - first.x),
      height: Math.abs(second.y - first.y)
    };
  }

  function frameLabelPosition(frame) {
    return { x: frame.x + 10, y: frame.y };
  }

  function frameLabelCanvasStyle(frame) {
    const position = frameLabelPosition(frame);
    return {
      left: position.x,
      top: position.y,
      originY: "center",
      fill: frameFormatting(frame).color,
      backgroundColor: "#f7f8fb"
    };
  }

  function noteCanvasGeometry(note) {
    return {
      left: note.x,
      top: note.y,
      width: note.width,
      angle: note.angle ?? 0,
      ...noteFormatting(note)
    };
  }

  function noteStateGeometry(object) {
    return {
      x: object.left,
      y: object.top,
      width: object.width * object.scaleX,
      angle: object.angle,
      text: object.text,
      ...noteFormatting(object)
    };
  }

  function codeFontSize(block) {
    return CODE_FONT_SIZES[block.size] || CODE_FONT_SIZES.medium;
  }

  function codeCanvasGeometry(block) {
    const style = NOTE_PARAGRAPH_STYLES.code;
    return {
      left: block.x,
      top: block.y,
      width: block.width,
      angle: block.angle ?? 0,
      fontFamily: style.fontFamily,
      fontSize: codeFontSize(block),
      lineHeight: style.lineHeight
    };
  }

  function codeStateGeometry(object) {
    return {
      x: object.left,
      y: object.top,
      width: object.width * object.scaleX,
      angle: object.angle,
      code: object.text
    };
  }

  function codeTokenStyles(runs) {
    const styles = {};
    let line = 0;
    let character = 0;
    runs.forEach(([text, style]) => {
      text.split("\n").forEach((segment, index) => {
        if (index > 0) {
          line += 1;
          character = 0;
        }
        Array.from(segment).forEach(() => {
          styles[line] = styles[line] || {};
          styles[line][character] = { ...style };
          character += 1;
        });
      });
    });
    return styles;
  }

  function sourceFromFields(path, startLine, endLine) {
    const trimmed = String(path || "").trim();
    if (!trimmed) return null;
    const lineNumber = (value) => {
      const number = Number.parseInt(value, 10);
      return number > 0 ? number : null;
    };
    return { path: trimmed, startLine: lineNumber(startLine), endLine: lineNumber(endLine) };
  }

  function codeLineLabels(block, lineCount) {
    if (block.source?.model) {
      return Array.from({ length: lineCount }, (_, index) => block.lineNumbers?.[index] ?? null);
    }
    const first = block.source?.startLine || 1;
    return Array.from({ length: lineCount }, (_, index) => first + index);
  }

  function codeGutterWidth(labels, fontSize) {
    const digits = Math.max(1, ...labels.filter((label) => label !== null).map((label) => String(label).length));
    return (digits + 2) * fontSize * 0.6;
  }

  function codeRowAt(rowHeights, y) {
    let top = 0;
    for (let index = 0; index < rowHeights.length; index += 1) {
      if (y >= top && y < top + rowHeights[index]) return index;
      top += rowHeights[index];
    }
    return -1;
  }

  function toggleHighlightedLine(lines = [], label) {
    if (lines.includes(label)) return lines.filter((line) => line !== label);
    return [...lines, label].sort((first, second) => first - second);
  }

  function highlightLineRange(lines = [], labels, anchor, label) {
    const start = labels.indexOf(anchor);
    const end = labels.indexOf(label);
    if (start < 0 || end < 0) return toggleHighlightedLine(lines, label);

    const range = labels.slice(Math.min(start, end), Math.max(start, end) + 1).filter((line) => line !== null);
    if (!lines.includes(anchor)) return lines.filter((line) => !range.includes(line));
    return [...new Set([...lines, ...range])].sort((first, second) => first - second);
  }

  function modelDetailBlock(codeBlocks, entityId, detail) {
    return codeBlocks.find((block) => block.source?.model === entityId && block.source.detail === detail) || null;
  }

  function modelDetailOrigin(tablePosition) {
    return { x: tablePosition.x + CARD_WIDTH + 80, y: tablePosition.y };
  }

  function sourceReferenceLabel(source) {
    if (source.model) return `${source.model} ${source.detail}`;
    if (!source.startLine && !source.endLine) return source.path;
    if (source.startLine === source.endLine) return `${source.path}:${source.startLine}`;
    return `${source.path}:${source.startLine || 1}-${source.endLine || "end"}`;
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
      c: "addCode",
      a: "arrow",
      t: "toggleTables",
      l: "layoutTables",
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

  function noteFormattingShortcut(event) {
    if (!(event.metaKey || event.ctrlKey)) return null;
    if (event.altKey) {
      return {
        Digit1: "title",
        Digit2: "heading",
        Digit3: "paragraph",
        Digit4: "code"
      }[event.code] || null;
    }
    return { b: "bold", i: "italic", u: "underline" }[String(event.key).toLowerCase()] || null;
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

  function arrowAttachment(target) {
    if (target?.canvasErdType === "entity") return { type: "entity", id: target.entityId };
    if (target?.canvasErdType === "note") return { type: "note", id: target.noteId };
    if (target?.canvasErdType === "code") return { type: "code", id: target.codeBlockId };
    return null;
  }

  function arrowIdForEndpointEditing(target) {
    return target?.canvasErdType === "arrow" ? target.arrowId : null;
  }

  function canvasLayer(type) {
    if (["frame", "frame-preview"].includes(type)) return -2;
    if (type === "frame-label") return -1;
    if (type === "relationship") return 0;
    if (["arrow", "arrow-preview"].includes(type)) return 2;
    if (type === "arrow-endpoint") return 3;
    return 1;
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

  function createState(schema, positions = layoutEntities(schema.entities)) {
    return {
      includedEntityIds: schema.entities.map((entity) => entity.id),
      positions,
      tableHeaderColors: {},
      frames: [],
      notes: [],
      codeBlocks: [],
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
        tableHeaderColors: { ...(state.tableHeaderColors || {}) },
        frames: (state.frames || []).map((frame) => ({ ...frame })),
        notes: state.notes.map((note) => ({ ...note })),
        codeBlocks: (state.codeBlocks || []).map((block) => ({
          ...block,
          source: block.source ? { ...block.source } : null
        })),
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

  function crowFootCardinality(range) {
    const minimum = Number(range.minimum);
    const maximum = range.maximum === null ? null : Number(range.maximum);
    if (![0, 1].includes(minimum) || ![1, null].includes(maximum)) return null;
    return { optional: minimum === 0, many: maximum === null };
  }

  function cardinalityEndpointGeometry(boundary, outward, range) {
    const magnitude = Math.hypot(outward.x, outward.y) || 1;
    const unit = { x: outward.x / magnitude, y: outward.y / magnitude };
    const tangent = { x: -unit.y, y: unit.x };
    const point = (origin, along, across = 0) => ({
      x: origin.x + unit.x * along + tangent.x * across,
      y: origin.y + unit.y * along + tangent.y * across
    });
    const cardinality = crowFootCardinality(range);
    if (!cardinality) {
      return {
        boundary: { ...boundary },
        shaftPoint: { ...boundary },
        segments: [],
        circles: [],
        label: rangeLabel(range),
        labelPosition: point(boundary, 18)
      };
    }

    const segments = [];
    const circles = [];
    const maximumMarker = point(boundary, 9);
    let cursor;
    if (cardinality.many) {
      const vertex = point(maximumMarker, 12);
      segments.push(
        { start: { ...boundary }, end: maximumMarker },
        { start: vertex, end: point(maximumMarker, 0, -7) },
        { start: vertex, end: maximumMarker },
        { start: vertex, end: point(maximumMarker, 0, 7) }
      );
      cursor = vertex;
    } else {
      cursor = point(maximumMarker, 5);
      segments.push(
        { start: { ...boundary }, end: cursor },
        { start: point(maximumMarker, 0, -7), end: point(maximumMarker, 0, 7) }
      );
    }

    let shaftPoint;
    if (cardinality.optional) {
      const nearEdge = point(cursor, 3);
      const center = point(nearEdge, 4);
      shaftPoint = point(center, 7);
      segments.push({ start: cursor, end: nearEdge });
      circles.push({ center, radius: 4 });
    } else {
      const minimumMarker = point(cursor, 6);
      shaftPoint = point(cursor, 12);
      segments.push(
        { start: cursor, end: shaftPoint },
        { start: point(minimumMarker, 0, -7), end: point(minimumMarker, 0, 7) }
      );
    }

    return {
      boundary: { ...boundary },
      shaftPoint,
      segments,
      circles,
      label: null,
      labelPosition: null
    };
  }

  function relationshipEndpointGeometry(bounds, toward, range) {
    const center = {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2
    };
    const delta = { x: toward.x - center.x, y: toward.y - center.y };
    const magnitude = Math.hypot(delta.x, delta.y) || 1;
    const unit = { x: delta.x / magnitude, y: delta.y / magnitude };
    const xDistance = unit.x === 0 ? Infinity : bounds.width / 2 / Math.abs(unit.x);
    const yDistance = unit.y === 0 ? Infinity : bounds.height / 2 / Math.abs(unit.y);
    const distance = Math.min(xDistance, yDistance);
    const boundary = {
      x: center.x + unit.x * distance,
      y: center.y + unit.y * distance
    };
    return cardinalityEndpointGeometry(boundary, unit, range);
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
    NOTE_PADDING,
    CANVAS_FONT_FAMILY,
    DEFAULT_BACKGROUND_COLORS,
    DEFAULT_FOREGROUND_COLORS,
    NOTE_PARAGRAPH_STYLES,
    DEFAULT_TABLE_HEADER_COLOR,
    DEFAULT_TABLE_HEADER_COLORS,
    DEFAULT_ARROW_FORMATTING,
    DEFAULT_FRAME_FORMATTING,
    DEFAULT_NOTE_FORMATTING,
    topLeft,
    uncachedText,
    paddedBackgroundBounds,
    noteSelectionPadding,
    noteFormatting,
    noteParagraphStyle,
    noteParagraphStyleFormatting,
    inheritedNoteFormatting,
    noteColorSwatches,
    colorPaletteSections,
    noteBorderColor,
    tableHeaderColor,
    setTableHeaderColor,
    tableHeaderColorSwatches,
    selectedTableHeaderColor,
    arrowFormatting,
    arrowStrokeDashArray,
    arrowHeadGeometry,
    shortenedArrowLinePoints,
    arrowColorSwatches,
    frameFormatting,
    frameColorSwatches,
    frameBounds,
    frameLabelPosition,
    frameLabelCanvasStyle,
    noteCanvasGeometry,
    noteStateGeometry,
    CODE_FONT_SIZES,
    codeFontSize,
    codeCanvasGeometry,
    codeStateGeometry,
    codeTokenStyles,
    sourceFromFields,
    sourceReferenceLabel,
    codeLineLabels,
    codeGutterWidth,
    codeRowAt,
    toggleHighlightedLine,
    highlightLineRange,
    modelDetailBlock,
    modelDetailOrigin,
    erdFilename,
    diagramName,
    confirmDiscardChanges,
    shortcutAction,
    isSaveShortcut,
    noteFormattingShortcut,
    selectedDiagramFilename,
    notePositionAt,
    snapPointToBounds,
    pointAtAnchor,
    arrowAttachment,
    arrowIdForEndpointEditing,
    canvasLayer,
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
    rangeLabel,
    cardinalityLabel,
    crowFootCardinality,
    cardinalityEndpointGeometry,
    relationshipEndpointGeometry,
    fitViewport,
    panViewport,
    zoomForWheel,
    shouldCacheTable,
    createPanScheduler,
    createPanQualityController
  };
});
