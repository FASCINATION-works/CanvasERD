"use strict";

const statusElement = document.querySelector("#status");
const loadingElement = document.querySelector("#loading");
const panelElement = document.querySelector("#canvas-panel");
const tableListElement = document.querySelector("#table-list");
const tablesSidebarElement = document.querySelector("#tables-sidebar");
const toggleTablesButton = document.querySelector("#toggle-tables");
const searchElement = document.querySelector("#table-search");
const refreshButton = document.querySelector("#refresh-schema");
const saveButton = document.querySelector("#save-diagram");
const newButton = document.querySelector("#new-diagram");
const openButton = document.querySelector("#open-diagram");
const editNameButton = document.querySelector("#edit-diagram-name");
const diagramNameElement = document.querySelector("#diagram-name");
const diagramNameDisplayElement = document.querySelector("#diagram-name-display");
const savedDiagramsElement = document.querySelector("#saved-diagrams");
const noticeElement = document.querySelector("#notice");
const shortcutHelpButton = document.querySelector("#shortcut-help");
const shortcutPanelElement = document.querySelector("#shortcut-panel");
const arrowButton = document.querySelector("#add-arrow");
const frameButton = document.querySelector("#add-frame");
const layoutTablesButton = document.querySelector("#layout-tables");
const noteFormattingElement = document.querySelector("#note-formatting");
const noteBoldButton = document.querySelector("#note-bold");
const noteItalicButton = document.querySelector("#note-italic");
const noteUnderlineButton = document.querySelector("#note-underline");
const noteParagraphStyleElement = document.querySelector("#note-paragraph-style");
const noteAlignmentElement = document.querySelector("#note-alignment");
const tableFormattingElement = document.querySelector("#table-formatting");
const tableHeaderColorControl = {
  button: document.querySelector("#table-header-color-button"),
  preview: document.querySelector("#table-header-color-preview"),
  menu: document.querySelector("#table-header-color-menu"),
  swatches: document.querySelector("#table-header-color-swatches"),
  custom: document.querySelector("#table-header-custom-color")
};
const arrowFormattingElement = document.querySelector("#arrow-formatting");
const arrowStartHeadElement = document.querySelector("#arrow-start-head");
const arrowEndHeadElement = document.querySelector("#arrow-end-head");
const arrowLineStyleElement = document.querySelector("#arrow-line-style");
const arrowStrokeWidthElement = document.querySelector("#arrow-stroke-width");
const arrowColorControl = {
  button: document.querySelector("#arrow-color-button"),
  preview: document.querySelector("#arrow-color-preview"),
  menu: document.querySelector("#arrow-color-menu"),
  swatches: document.querySelector("#arrow-color-swatches"),
  custom: document.querySelector("#arrow-custom-color")
};
const frameFormattingElement = document.querySelector("#frame-formatting");
const frameLineStyleElement = document.querySelector("#frame-line-style");
const frameColorControl = {
  button: document.querySelector("#frame-color-button"),
  preview: document.querySelector("#frame-color-preview"),
  menu: document.querySelector("#frame-color-menu"),
  swatches: document.querySelector("#frame-color-swatches"),
  custom: document.querySelector("#frame-custom-color")
};
const noteColorControls = [
  {
    property: "fill",
    defaults: CanvasERDDocument.DEFAULT_FOREGROUND_COLORS,
    button: document.querySelector("#note-text-color-button"),
    preview: document.querySelector("#note-text-color-preview"),
    menu: document.querySelector("#note-text-color-menu"),
    swatches: document.querySelector("#note-text-color-swatches"),
    custom: document.querySelector("#note-text-custom-color")
  },
  {
    property: "backgroundColor",
    defaults: CanvasERDDocument.DEFAULT_BACKGROUND_COLORS,
    button: document.querySelector("#note-background-color-button"),
    preview: document.querySelector("#note-background-color-preview"),
    menu: document.querySelector("#note-background-color-menu"),
    swatches: document.querySelector("#note-background-color-swatches"),
    custom: document.querySelector("#note-background-custom-color"),
    transparent: document.querySelector("#note-background-transparent")
  }
];

let schema;
let applicationSchema;
let state;
let canvas;
let relationFrame;
let isPanning = false;
let spacePressed = false;
let lastPointer = null;
let lastCanvasPointer = null;
const tableObjects = new Map();
let relationshipObjects = [];
const noteObjects = new Map();
const arrowObjects = new Map();
const frameObjects = new Map();
const frameLabelObjects = new Map();
let noticeTimer;
let currentDiagramFilename = null;
let diagramsDirectory = "docs/erd";
let isSaving = false;
let isEditingName = false;
let nameBeforeEditing = "Untitled ERD";
let arrowMode = false;
let drawingArrow = null;
let arrowPreview = null;
let editingArrowId = null;
let frameMode = false;
let drawingFrame = null;
let framePreview = null;
let lastNoteFormatting = CanvasERDDocument.inheritedNoteFormatting();
const arrowEndpointHandles = new Map();
const changeTracker = CanvasERDDocument.createChangeTracker(updateSaveButton);
const layoutEngine = new ELK({ workerUrl: "/assets/elk-worker.min.js" });

function layoutPositions(nextSchema) {
  return CanvasERDLayout.layoutEntities(nextSchema, layoutEngine, {
    width: () => CanvasERDDocument.CARD_WIDTH,
    height: CanvasERDDocument.tableHeight
  });
}

async function createInitialState(nextSchema) {
  try {
    const positions = await layoutPositions(nextSchema);
    return CanvasERDDocument.createState(nextSchema, positions);
  } catch (error) {
    console.warn("ELK layout failed; using the fallback layout.", error);
    showNotice("ELK layout failed; using the fallback layout.", true);
    return CanvasERDDocument.createState(nextSchema);
  }
}

function updateSaveButton() {
  saveButton.disabled = isSaving || !changeTracker.isDirty();
  diagramNameElement.disabled = isSaving;
  editNameButton.disabled = isSaving;
}

function markDirty() {
  changeTracker.markDirty();
}

function setDiagramName(value) {
  const name = CanvasERDDocument.diagramName(value);
  diagramNameElement.value = name;
  diagramNameDisplayElement.textContent = name;
}

function beginNameEditing() {
  if (isSaving) return;
  isEditingName = true;
  nameBeforeEditing = diagramNameElement.value;
  diagramNameDisplayElement.hidden = true;
  editNameButton.hidden = true;
  diagramNameElement.hidden = false;
  diagramNameElement.focus();
  diagramNameElement.select();
}

function finishNameEditing(cancel = false) {
  if (!isEditingName) return;

  isEditingName = false;
  const nextName = cancel ? nameBeforeEditing : CanvasERDDocument.diagramName(diagramNameElement.value);
  setDiagramName(nextName);
  diagramNameElement.hidden = true;
  diagramNameDisplayElement.hidden = false;
  editNameButton.hidden = false;
  if (!cancel && nextName !== nameBeforeEditing) markDirty();
}

function showSavedDiagrams(visible) {
  savedDiagramsElement.hidden = !visible;
  openButton.setAttribute("aria-expanded", String(visible));
  if (visible) savedDiagramsElement.focus();
}

function openSavedDiagrams() {
  showSavedDiagrams(true);
  if (typeof savedDiagramsElement.showPicker !== "function") return;
  try {
    savedDiagramsElement.showPicker();
  } catch (_error) {
    // The visible select remains available when the browser cannot open it programmatically.
  }
}

function showShortcutHelp(visible) {
  shortcutPanelElement.hidden = !visible;
  shortcutHelpButton.setAttribute("aria-expanded", String(visible));
}

function setTablesCollapsed(collapsed) {
  tablesSidebarElement.classList.toggle("collapsed", collapsed);
  toggleTablesButton.setAttribute("aria-expanded", String(!collapsed));
  const label = collapsed ? "Show tables" : "Hide tables";
  toggleTablesButton.setAttribute("aria-label", label);
  toggleTablesButton.title = `${label} (T)`;
}

function updateTableCaching() {
  const enabled = CanvasERDDocument.shouldCacheTable(canvas.getZoom(), canvas.getRetinaScaling());
  tableObjects.forEach((table) => {
    if (table.objectCaching === enabled) return;
    table.objectCaching = enabled;
    table.dirty = true;
  });
}

function updateNoteSelectionPadding() {
  const padding = CanvasERDDocument.noteSelectionPadding(canvas.getZoom());
  noteObjects.forEach((note) => {
    if (note.padding === padding) return;
    note.padding = padding;
    note.setCoords();
  });
}

function updateZoomDependentObjects() {
  updateTableCaching();
  updateNoteSelectionPadding();
}

const scheduleViewportPan = CanvasERDDocument.createPanScheduler((deltaX, deltaY) => {
  canvas.setViewportTransform(CanvasERDDocument.panViewport(canvas.viewportTransform, deltaX, deltaY));
  canvas.requestRenderAll();
  markDirty();
});
const panQuality = CanvasERDDocument.createPanQualityController((enabled) => {
  if (canvas.enableRetinaScaling === enabled) return;
  canvas.enableRetinaScaling = enabled;
  updateTableCaching();
  canvas.setDimensions({ width: canvas.width, height: canvas.height });
});

function truncate(value, length) {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

function createTableObject(entity) {
  const width = CanvasERDDocument.CARD_WIDTH;
  const height = CanvasERDDocument.tableHeight(entity);
  const headerColor = CanvasERDDocument.tableHeaderColor(state, entity.id);
  const objects = [
    new fabric.Rect(CanvasERDDocument.topLeft({
      left: 0,
      top: 0,
      width,
      height,
      fill: "#ffffff",
      stroke: "#b8c2d1",
      strokeWidth: 1,
      rx: 8,
      ry: 8,
      shadow: "rgba(15, 23, 42, 0.14) 0 4px 12px"
    })),
    new fabric.Rect(CanvasERDDocument.topLeft({
      left: 0,
      top: 0,
      width,
      height: CanvasERDDocument.HEADER_HEIGHT,
      fill: headerColor,
      rx: 8,
      ry: 8
    })),
    new fabric.Rect(CanvasERDDocument.topLeft({
      left: 0,
      top: CanvasERDDocument.HEADER_HEIGHT - 8,
      width,
      height: 8,
      fill: headerColor
    })),
    new fabric.FabricText(truncate(entity.label, 34), CanvasERDDocument.uncachedText({
      left: 14,
      top: 9,
      fill: "#ffffff",
      fontFamily: CanvasERDDocument.CANVAS_FONT_FAMILY,
      fontSize: 16,
      fontWeight: "600"
    })),
    new fabric.FabricText(truncate(entity.table_name || entity.name, 42), CanvasERDDocument.uncachedText({
      left: 14,
      top: 33,
      fill: "#c9d7ee",
      fontFamily: CanvasERDDocument.CANVAS_FONT_FAMILY,
      fontSize: 10
    }))
  ];

  const attributes = entity.attributes.length > 0 ? entity.attributes : [{ name: "Attributes hidden", type: "" }];
  attributes.forEach((attribute, index) => {
    const top = CanvasERDDocument.HEADER_HEIGHT + 5 + index * CanvasERDDocument.ROW_HEIGHT;
    const markers = [
      attribute.primary_key ? "PK" : null,
      attribute.foreign_key ? "FK" : null
    ].filter(Boolean).join("/");
    const name = markers ? `${markers}  ${attribute.name}` : attribute.name;

    if (index > 0) {
      objects.push(new fabric.Rect(CanvasERDDocument.topLeft({
        left: 10,
        top: top - 3,
        width: width - 20,
        height: 1,
        fill: "#edf0f5",
        stroke: "#edf0f5",
        strokeWidth: 0,
        selectable: false,
        evented: false
      })));
    }

    objects.push(new fabric.FabricText(truncate(name, 28), CanvasERDDocument.uncachedText({
      left: 13,
      top,
      fill: attribute.primary_key ? "#172554" : "#263447",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 11,
      fontWeight: attribute.primary_key ? "600" : "400"
    })));
    objects.push(new fabric.FabricText(truncate(attribute.type || "", 16), CanvasERDDocument.uncachedText({
      left: width - 13,
      top,
      originX: "right",
      fill: "#6b778c",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 10
    })));
  });

  const position = state.positions[entity.id];
  const group = new fabric.Group(objects, CanvasERDDocument.topLeft({
    left: position.x,
    top: position.y,
    hasControls: false,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    objectCaching: CanvasERDDocument.shouldCacheTable(canvas.getZoom(), canvas.getRetinaScaling()),
    borderColor: "#2563eb",
    cornerColor: "#2563eb"
  }));
  group.canvasErdType = "entity";
  group.entityId = entity.id;
  return group;
}

function addTable(entity) {
  if (tableObjects.has(entity.id)) return;

  const table = createTableObject(entity);
  tableObjects.set(entity.id, table);
  canvas.add(table);
}

function removeTable(entityId) {
  const table = tableObjects.get(entityId);
  if (!table) return;

  canvas.remove(table);
  tableObjects.delete(entityId);
}

function tableBounds(table) {
  return {
    left: table.left,
    top: table.top,
    width: table.getScaledWidth(),
    height: table.getScaledHeight()
  };
}

function relationStyle(relationship) {
  return {
    fill: "",
    stroke: relationship.indirect ? "#94a3b8" : "#62748e",
    strokeWidth: 1.5,
    strokeDashArray: relationship.indirect ? [7, 6] : null,
    selectable: false,
    evented: false,
    objectCaching: false
  };
}

function createCardinalityObjects(geometry, style) {
  const markerStyle = { ...style, strokeDashArray: null };
  const objects = geometry.segments.map(({ start, end }) => (
    new fabric.Line([start.x, start.y, end.x, end.y], markerStyle)
  ));
  geometry.circles.forEach(({ center, radius }) => {
    objects.push(new fabric.Circle({
      left: center.x,
      top: center.y,
      originX: "center",
      originY: "center",
      radius,
      fill: "#f7f8fb",
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      selectable: false,
      evented: false,
      objectCaching: false
    }));
  });
  if (geometry.label) {
    objects.push(new fabric.FabricText(geometry.label, {
      left: geometry.labelPosition.x,
      top: geometry.labelPosition.y,
      originX: "center",
      originY: "center",
      fontFamily: CanvasERDDocument.CANVAS_FONT_FAMILY,
      fontSize: 10,
      fill: "#526277",
      backgroundColor: "#f7f8fb",
      selectable: false,
      evented: false
    }));
  }
  return objects;
}

function createRelationshipObjects(relationship, source, destination) {
  const sourceBounds = tableBounds(source);
  const destinationBounds = tableBounds(destination);
  const style = relationStyle(relationship);
  let connector;
  let sourceEndpoint;
  let destinationEndpoint;

  if (source === destination) {
    const right = sourceBounds.left + sourceBounds.width;
    const top = sourceBounds.top;
    const centerY = top + sourceBounds.height / 2;
    sourceEndpoint = CanvasERDDocument.cardinalityEndpointGeometry(
      { x: right, y: centerY },
      { x: 1, y: 0 },
      relationship.cardinality.source
    );
    destinationEndpoint = CanvasERDDocument.cardinalityEndpointGeometry(
      { x: right - 20, y: top },
      { x: 0, y: -1 },
      relationship.cardinality.destination
    );
    const points = [
      sourceEndpoint.shaftPoint,
      { x: right + 48, y: centerY },
      { x: right + 48, y: top - 48 },
      { x: right - 20, y: top - 48 },
      destinationEndpoint.shaftPoint
    ];
    connector = new fabric.Polyline(points, style);
  } else {
    const sourceCenter = {
      x: sourceBounds.left + sourceBounds.width / 2,
      y: sourceBounds.top + sourceBounds.height / 2
    };
    const destinationCenter = {
      x: destinationBounds.left + destinationBounds.width / 2,
      y: destinationBounds.top + destinationBounds.height / 2
    };
    sourceEndpoint = CanvasERDDocument.relationshipEndpointGeometry(
      sourceBounds,
      destinationCenter,
      relationship.cardinality.source
    );
    destinationEndpoint = CanvasERDDocument.relationshipEndpointGeometry(
      destinationBounds,
      sourceCenter,
      relationship.cardinality.destination
    );
    connector = new fabric.Line([
      sourceEndpoint.shaftPoint.x,
      sourceEndpoint.shaftPoint.y,
      destinationEndpoint.shaftPoint.x,
      destinationEndpoint.shaftPoint.y
    ], style);
  }

  const objects = [
    connector,
    ...createCardinalityObjects(sourceEndpoint, style),
    ...createCardinalityObjects(destinationEndpoint, style)
  ];
  objects.forEach((object) => { object.canvasErdType = "relationship"; });
  return objects;
}

function renderRelationships() {
  relationshipObjects.forEach((object) => canvas.remove(object));
  relationshipObjects = [];

  CanvasERDDocument.visibleRelationships(schema, state.includedEntityIds).forEach((relationship) => {
    const source = tableObjects.get(relationship.source_id);
    const destination = tableObjects.get(relationship.destination_id);
    if (!source || !destination) return;

    const objects = createRelationshipObjects(relationship, source, destination);
    relationshipObjects.push(...objects);
    canvas.add(...objects);
  });

  restackCanvasObjects();
  canvas.requestRenderAll();
  updateStatus();
}

function scheduleRelationshipRender() {
  if (relationFrame) return;
  relationFrame = requestAnimationFrame(() => {
    relationFrame = null;
    renderRelationships();
    renderArrows();
  });
}

function renderTables() {
  const included = new Set(state.includedEntityIds);
  schema.entities.forEach((entity) => {
    if (included.has(entity.id)) addTable(entity);
    else removeTable(entity.id);
  });
  renderRelationships();
  renderArrows();
}

function rebuildTables() {
  relationshipObjects.forEach((object) => canvas.remove(object));
  relationshipObjects = [];
  tableObjects.forEach((object) => canvas.remove(object));
  tableObjects.clear();
  renderTables();
}

async function layoutTables() {
  if (layoutTablesButton.disabled) return;
  const layoutSchema = CanvasERDLayout.schemaForEntityIds(schema, state.includedEntityIds);
  if (layoutSchema.entities.length === 0) {
    showNotice("There are no tables to lay out.", true);
    return;
  }

  layoutTablesButton.disabled = true;
  showNotice(`Laying out ${layoutSchema.entities.length} tables…`);
  try {
    const positions = await layoutPositions(layoutSchema);
    state.positions = { ...state.positions, ...positions };
    canvas.discardActiveObject();
    rebuildTables();
    markDirty();
    showNotice(`Laid out ${layoutSchema.entities.length} tables.`);
  } catch (error) {
    console.warn("ELK layout failed.", error);
    showNotice("Could not lay out tables.", true);
  } finally {
    layoutTablesButton.disabled = false;
  }
}

function createNoteObject(note) {
  const borderColor = CanvasERDDocument.noteBorderColor(
    CanvasERDDocument.noteFormatting(note).backgroundColor
  );
  const object = new fabric.Textbox(note.text, CanvasERDDocument.uncachedText({
    ...CanvasERDDocument.noteCanvasGeometry(note),
    padding: CanvasERDDocument.noteSelectionPadding(canvas.getZoom()),
    borderColor,
    editingBorderColor: borderColor,
    cornerColor: borderColor,
    transparentCorners: false,
    lockScalingY: true
  }));
  object._renderBackground = function (context) {
    if (!this.backgroundColor) return;

    const dimensions = this._getNonTransformedDimensions();
    const bounds = CanvasERDDocument.paddedBackgroundBounds(
      dimensions.x,
      dimensions.y,
      CanvasERDDocument.NOTE_PADDING
    );
    context.fillStyle = this.backgroundColor;
    context.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    this._removeShadow(context);
  };
  object.canvasErdType = "note";
  object.noteId = note.id;
  return object;
}

function activeNoteObject() {
  const active = canvas?.getActiveObject();
  return active?.canvasErdType === "note" ? active : null;
}

function activeTableEntityIds() {
  return CanvasERDDocument.selectedEntityIds(canvas?.getActiveObject());
}

function updateNoteFormattingControls() {
  const note = activeNoteObject();
  noteFormattingElement.hidden = !note;
  if (!note) return;

  const formatting = CanvasERDDocument.noteFormatting(note);
  lastNoteFormatting = CanvasERDDocument.inheritedNoteFormatting(formatting);
  noteBoldButton.setAttribute("aria-pressed", String(formatting.fontWeight === "bold"));
  noteItalicButton.setAttribute("aria-pressed", String(formatting.fontStyle === "italic"));
  noteUnderlineButton.setAttribute("aria-pressed", String(formatting.underline));
  noteColorControls.forEach((control) => {
    const color = formatting[control.property];
    control.preview.style.backgroundColor = color;
    control.preview.classList.toggle("transparent-color", color === "transparent");
    if (control.transparent) {
      control.transparent.setAttribute("aria-pressed", String(color === "transparent"));
    }
    if (/^#[0-9a-f]{6}$/i.test(color)) control.custom.value = color;
  });
  noteParagraphStyleElement.value = formatting.paragraphStyle;
  noteAlignmentElement.value = formatting.textAlign;
}

function closeNoteFormattingMenus() {
  let closed = false;
  noteColorControls.forEach((control) => {
    if (!control.menu.hidden) closed = true;
    control.menu.hidden = true;
    control.button.setAttribute("aria-expanded", "false");
  });
  if (!tableHeaderColorControl.menu.hidden) closed = true;
  tableHeaderColorControl.menu.hidden = true;
  tableHeaderColorControl.button.setAttribute("aria-expanded", "false");
  if (!arrowColorControl.menu.hidden) closed = true;
  arrowColorControl.menu.hidden = true;
  arrowColorControl.button.setAttribute("aria-expanded", "false");
  if (!frameColorControl.menu.hidden) closed = true;
  frameColorControl.menu.hidden = true;
  frameColorControl.button.setAttribute("aria-expanded", "false");
  return closed;
}

function renderColorSwatches(element, colors, defaults, currentColor, applyColor) {
  const fragment = document.createDocumentFragment();
  const sections = CanvasERDDocument.colorPaletteSections(colors, defaults);
  const appendSwatches = (swatches) => swatches.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.className = "color-swatch";
    swatch.type = "button";
    swatch.title = color;
    swatch.setAttribute("aria-label", `Use ${color}`);
    swatch.setAttribute("aria-pressed", String(color === currentColor));
    swatch.style.backgroundColor = color;
    swatch.classList.toggle("transparent-color", color === "transparent");
    swatch.addEventListener("click", () => {
      applyColor(color);
      closeNoteFormattingMenus();
    });
    fragment.append(swatch);
  });
  appendSwatches(sections.defaults);
  if (sections.custom.length > 0) {
    const separator = document.createElement("div");
    separator.className = "swatch-separator";
    separator.setAttribute("role", "separator");
    fragment.append(separator);
    appendSwatches(sections.custom);
  }
  element.replaceChildren(fragment);
}

function renderNoteColorSwatches(control) {
  const note = activeNoteObject();
  if (!note) return;

  const currentColor = CanvasERDDocument.noteFormatting(note)[control.property].toLowerCase();
  renderColorSwatches(
    control.swatches,
    CanvasERDDocument.noteColorSwatches(state.notes, control.property, control.defaults),
    control.defaults,
    currentColor,
    (color) => applyNoteFormatting({ [control.property]: color })
  );
}

function toggleNoteColorMenu(control) {
  const opening = control.menu.hidden;
  closeNoteFormattingMenus();
  if (!opening || !activeNoteObject()) return;

  renderNoteColorSwatches(control);
  control.menu.hidden = false;
  control.button.setAttribute("aria-expanded", "true");
}

function updateTableFormattingControls() {
  const entityIds = activeTableEntityIds();
  tableFormattingElement.hidden = entityIds.length === 0;
  if (entityIds.length === 0) return;

  const color = CanvasERDDocument.selectedTableHeaderColor(state, entityIds);
  tableHeaderColorControl.preview.style.backgroundColor = color || "#ffffff";
  tableHeaderColorControl.preview.classList.toggle("mixed-color", color === null);
  if (color) tableHeaderColorControl.custom.value = color;
}

function applyTableHeaderColor(color) {
  const entityIds = activeTableEntityIds();
  if (entityIds.length === 0) return;

  state = CanvasERDDocument.setTableHeaderColor(state, entityIds, color);
  entityIds.forEach((entityId) => {
    const table = tableObjects.get(entityId);
    if (!table) return;
    table.getObjects().slice(1, 3).forEach((header) => header.set({ fill: color }));
    table.dirty = true;
  });
  updateTableFormattingControls();
  canvas.requestRenderAll();
  markDirty();
}

function renderTableHeaderColorSwatches() {
  const entityIds = activeTableEntityIds();
  if (entityIds.length === 0) return;

  renderColorSwatches(
    tableHeaderColorControl.swatches,
    CanvasERDDocument.tableHeaderColorSwatches(state.tableHeaderColors),
    CanvasERDDocument.DEFAULT_TABLE_HEADER_COLORS,
    CanvasERDDocument.selectedTableHeaderColor(state, entityIds),
    applyTableHeaderColor
  );
}

function toggleTableHeaderColorMenu() {
  const opening = tableHeaderColorControl.menu.hidden;
  closeNoteFormattingMenus();
  if (!opening || activeTableEntityIds().length === 0) return;

  renderTableHeaderColorSwatches();
  tableHeaderColorControl.menu.hidden = false;
  tableHeaderColorControl.button.setAttribute("aria-expanded", "true");
}

function editingArrow() {
  return state.arrows.find((arrow) => arrow.id === editingArrowId) || null;
}

function updateArrowFormattingControls() {
  const arrow = editingArrow();
  arrowFormattingElement.hidden = !arrow;
  if (!arrow) return;

  const formatting = CanvasERDDocument.arrowFormatting(arrow);
  arrowColorControl.preview.style.backgroundColor = formatting.color;
  if (/^#[0-9a-f]{6}$/i.test(formatting.color)) arrowColorControl.custom.value = formatting.color;
  arrowStartHeadElement.value = formatting.startHead;
  arrowEndHeadElement.value = formatting.endHead;
  arrowLineStyleElement.value = formatting.lineStyle;
  arrowStrokeWidthElement.value = formatting.strokeWidth;
}

function applyArrowFormatting(changes) {
  const arrow = editingArrow();
  if (!arrow) return;

  Object.assign(arrow, CanvasERDDocument.arrowFormatting({ ...arrow, ...changes }));
  renderArrows();
  updateArrowFormattingControls();
  markDirty();
}

function renderArrowColorSwatches() {
  const arrow = editingArrow();
  if (!arrow) return;

  renderColorSwatches(
    arrowColorControl.swatches,
    CanvasERDDocument.arrowColorSwatches(state.arrows),
    CanvasERDDocument.DEFAULT_FOREGROUND_COLORS,
    CanvasERDDocument.arrowFormatting(arrow).color.toLowerCase(),
    (color) => applyArrowFormatting({ color })
  );
}

function toggleArrowColorMenu() {
  const opening = arrowColorControl.menu.hidden;
  closeNoteFormattingMenus();
  if (!opening || !editingArrow()) return;

  renderArrowColorSwatches();
  arrowColorControl.menu.hidden = false;
  arrowColorControl.button.setAttribute("aria-expanded", "true");
}

function activeFrame() {
  const active = canvas?.getActiveObject();
  const frameId = ["frame", "frame-label"].includes(active?.canvasErdType) ? active.frameId : null;
  return state.frames.find((frame) => frame.id === frameId) || null;
}

function updateFrameFormattingControls() {
  const frame = activeFrame();
  frameFormattingElement.hidden = !frame;
  if (!frame) return;

  const formatting = CanvasERDDocument.frameFormatting(frame);
  frameColorControl.preview.style.backgroundColor = formatting.color;
  if (/^#[0-9a-f]{6}$/i.test(formatting.color)) frameColorControl.custom.value = formatting.color;
  frameLineStyleElement.value = formatting.lineStyle;
}

function applyFrameFormatting(changes) {
  const frame = activeFrame();
  if (!frame) return;

  Object.assign(frame, CanvasERDDocument.frameFormatting({ ...frame, ...changes }));
  frameObjects.get(frame.id)?.set({
    stroke: frame.color,
    strokeDashArray: CanvasERDDocument.arrowStrokeDashArray(frame.lineStyle),
    strokeLineCap: frame.lineStyle === "dotted" ? "round" : "butt"
  });
  frameLabelObjects.get(frame.id)?.set({ fill: frame.color });
  updateFrameFormattingControls();
  canvas.requestRenderAll();
  markDirty();
}

function renderFrameColorSwatches() {
  const frame = activeFrame();
  if (!frame) return;

  renderColorSwatches(
    frameColorControl.swatches,
    CanvasERDDocument.frameColorSwatches(state.frames),
    CanvasERDDocument.DEFAULT_FOREGROUND_COLORS,
    CanvasERDDocument.frameFormatting(frame).color.toLowerCase(),
    (color) => applyFrameFormatting({ color })
  );
}

function toggleFrameColorMenu() {
  const opening = frameColorControl.menu.hidden;
  closeNoteFormattingMenus();
  if (!opening || !activeFrame()) return;

  renderFrameColorSwatches();
  frameColorControl.menu.hidden = false;
  frameColorControl.button.setAttribute("aria-expanded", "true");
}

function applyNoteFormatting(formatting) {
  const note = activeNoteObject();
  if (!note) return;

  note.set(formatting);
  const borderColor = CanvasERDDocument.noteBorderColor(note.backgroundColor);
  note.set({ borderColor, editingBorderColor: borderColor, cornerColor: borderColor });
  note.setCoords();
  updateObjectState(note);
  updateNoteFormattingControls();
  canvas.requestRenderAll();
}

function toggleNoteFormatting(formatting) {
  const note = activeNoteObject();
  if (!note) return;

  if (formatting === "bold") {
    applyNoteFormatting({ fontWeight: note.fontWeight === "bold" ? "normal" : "bold" });
  } else if (formatting === "italic") {
    applyNoteFormatting({ fontStyle: note.fontStyle === "italic" ? "normal" : "italic" });
  } else if (formatting === "underline") {
    applyNoteFormatting({ underline: !note.underline });
  }
}

function renderNotes() {
  state.notes.forEach((note) => {
    const object = createNoteObject(note);
    noteObjects.set(note.id, object);
    canvas.add(object);
  });
}

function createFrameObject(frame) {
  const formatting = CanvasERDDocument.frameFormatting(frame);
  const object = new fabric.Rect(CanvasERDDocument.topLeft({
    left: frame.x,
    top: frame.y,
    width: frame.width,
    height: frame.height,
    fill: "transparent",
    stroke: formatting.color,
    strokeWidth: 2,
    strokeDashArray: CanvasERDDocument.arrowStrokeDashArray(formatting.lineStyle),
    strokeLineCap: formatting.lineStyle === "dotted" ? "round" : "butt",
    strokeUniform: true,
    objectCaching: false,
    perPixelTargetFind: true,
    padding: 4,
    borderColor: "#2563eb",
    cornerColor: "#2563eb",
    transparentCorners: false,
    lockRotation: true,
    lockSkewingX: true,
    lockSkewingY: true
  }));
  object.setControlsVisibility({ mtr: false });
  object.canvasErdType = "frame";
  object.frameId = frame.id;
  return object;
}

function createFrameLabelObject(frame) {
  const label = typeof frame.label === "string" ? frame.label : "Frame";
  const object = new fabric.IText(label, CanvasERDDocument.uncachedText({
    ...CanvasERDDocument.frameLabelCanvasStyle(frame),
    fontFamily: CanvasERDDocument.CANVAS_FONT_FAMILY,
    fontSize: 15,
    fontWeight: "bold",
    padding: 3,
    hasControls: false,
    lockMovementX: true,
    lockMovementY: true,
    borderColor: "#2563eb",
    editingBorderColor: "#2563eb"
  }));
  object.canvasErdType = "frame-label";
  object.frameId = frame.id;
  return object;
}

function renderFrames() {
  frameObjects.forEach((object) => canvas.remove(object));
  frameLabelObjects.forEach((object) => canvas.remove(object));
  frameObjects.clear();
  frameLabelObjects.clear();
  state.frames.forEach((frame) => {
    const object = createFrameObject(frame);
    const label = createFrameLabelObject(frame);
    frameObjects.set(frame.id, object);
    frameLabelObjects.set(frame.id, label);
    canvas.add(object, label);
  });
  restackCanvasObjects();
  canvas.requestRenderAll();
}

function renderFramePreview() {
  if (framePreview) canvas.remove(framePreview);
  const bounds = CanvasERDDocument.frameBounds(drawingFrame.start, drawingFrame.end);
  framePreview = new fabric.Rect(CanvasERDDocument.topLeft({
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fill: "rgba(37, 99, 235, 0.03)",
    stroke: "#2563eb",
    strokeWidth: 2,
    strokeDashArray: [7, 5],
    selectable: false,
    evented: false,
    objectCaching: false
  }));
  framePreview.canvasErdType = "frame-preview";
  canvas.add(framePreview);
  restackCanvasObjects();
  canvas.requestRenderAll();
}

function setFrameMode(active) {
  if (active && arrowMode) cancelArrowDrawing();
  if (active && editingArrowId) finishArrowEndpointEditing();
  frameMode = active;
  frameButton.setAttribute("aria-pressed", String(active));
  canvas.selection = !active;
  canvas.setCursor(active ? "crosshair" : "default");
  [
    ...frameObjects.values(),
    ...frameLabelObjects.values(),
    ...tableObjects.values(),
    ...noteObjects.values(),
    ...arrowObjects.values()
  ].forEach((object) => {
    object.selectable = !active;
    object.evented = !active;
  });
  if (active) canvas.discardActiveObject();
  canvas.requestRenderAll();
}

function cancelFrameDrawing() {
  if (framePreview) canvas.remove(framePreview);
  framePreview = null;
  drawingFrame = null;
  setFrameMode(false);
}

function finishFrameDrawing(point) {
  if (!drawingFrame) return;
  drawingFrame.end = point;
  const bounds = CanvasERDDocument.frameBounds(drawingFrame.start, drawingFrame.end);
  if (framePreview) canvas.remove(framePreview);
  framePreview = null;

  if (bounds.width >= 40 && bounds.height >= 30) {
    const frame = {
      id: globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `frame-${Date.now()}`,
      label: "Frame",
      ...bounds,
      ...CanvasERDDocument.DEFAULT_FRAME_FORMATTING
    };
    state.frames.push(frame);
    drawingFrame = null;
    renderFrames();
    setFrameMode(false);
    const label = frameLabelObjects.get(frame.id);
    canvas.setActiveObject(label);
    label.enterEditing();
    label.selectAll();
    canvas.requestRenderAll();
    markDirty();
  } else {
    drawingFrame = null;
    setFrameMode(false);
  }
}

function attachmentTarget(attachment) {
  if (!attachment) return null;
  if (attachment.type === "entity") return tableObjects.get(attachment.id);
  if (attachment.type === "note") return noteObjects.get(attachment.id);
  return null;
}

function resolveArrowEndpoint(endpoint) {
  const target = attachmentTarget(endpoint.attachment);
  if (!target) return { x: endpoint.x, y: endpoint.y };

  const point = CanvasERDDocument.pointAtAnchor(target.getBoundingRect(), endpoint.attachment);
  endpoint.x = point.x;
  endpoint.y = point.y;
  return point;
}

function attachableTargetAt(point) {
  const objects = [...noteObjects.values(), ...tableObjects.values()].reverse();
  return objects.find((object) => {
    const bounds = object.getBoundingRect();
    return point.x >= bounds.left && point.x <= bounds.left + bounds.width &&
      point.y >= bounds.top && point.y <= bounds.top + bounds.height;
  }) || null;
}

function endpointAt(point, target, free) {
  const attachment = free ? null : CanvasERDDocument.arrowAttachment(target);
  if (!attachment) return { x: point.x, y: point.y, attachment: null };

  const snapped = CanvasERDDocument.snapPointToBounds(point, target.getBoundingRect());
  return {
    ...snapped.point,
    attachment: { ...attachment, ...snapped.anchor }
  };
}

function arrowEndpoint(eventData) {
  const point = eventData.scenePoint || canvas.getScenePoint(eventData.e);
  return endpointAt(point, eventData.target, eventData.e.ctrlKey);
}

function drawArrowHead(context, point, angle, style, color, strokeWidth) {
  if (style === "none") return;

  const { length, halfWidth, radius } = CanvasERDDocument.arrowHeadGeometry(style, strokeWidth);
  context.save();
  context.translate(point.x, point.y);
  context.rotate(angle);
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash([]);
  context.beginPath();
  if (style === "open") {
    context.moveTo(-length, -halfWidth);
    context.lineTo(0, 0);
    context.lineTo(-length, halfWidth);
    context.stroke();
  } else if (["circle", "circle-open"].includes(style)) {
    context.arc(-radius, 0, radius, 0, Math.PI * 2);
    if (style === "circle-open") context.stroke();
    else context.fill();
  } else if (["diamond", "diamond-open"].includes(style)) {
    context.moveTo(0, 0);
    context.lineTo(-length / 2, -halfWidth);
    context.lineTo(-length, 0);
    context.lineTo(-length / 2, halfWidth);
    context.closePath();
    if (style === "diamond-open") context.stroke();
    else context.fill();
  } else {
    context.moveTo(0, 0);
    context.lineTo(-length, -halfWidth);
    context.lineTo(-length, halfWidth);
    context.closePath();
    context.fill();
  }
  context.restore();
}

function createArrowObject(arrow, options = {}) {
  const start = resolveArrowEndpoint(arrow.start);
  const end = resolveArrowEndpoint(arrow.end);
  const formatting = CanvasERDDocument.arrowFormatting(arrow);
  const color = options.stroke || formatting.color;
  const object = new fabric.Line([start.x, start.y, end.x, end.y], {
    stroke: color,
    strokeWidth: formatting.strokeWidth,
    strokeDashArray: CanvasERDDocument.arrowStrokeDashArray(formatting.lineStyle),
    strokeLineCap: formatting.lineStyle === "dotted" ? "round" : "butt",
    fill: color,
    objectCaching: false,
    perPixelTargetFind: true,
    padding: 6,
    borderColor: "#2563eb",
    cornerColor: "#2563eb",
    transparentCorners: false,
    selectable: options.selectable !== false,
    evented: options.evented !== false,
    lockSkewingX: true,
    lockSkewingY: true
  });
  object._render = function (context) {
    const points = this.calcLinePoints();
    const shaft = CanvasERDDocument.shortenedArrowLinePoints(
      points,
      formatting.startHead,
      formatting.endHead,
      this.strokeWidth
    );
    context.save();
    context.beginPath();
    context.moveTo(shaft.x1, shaft.y1);
    context.lineTo(shaft.x2, shaft.y2);
    context.strokeStyle = this.stroke;
    context.lineWidth = this.strokeWidth;
    context.lineCap = this.strokeLineCap;
    context.setLineDash(this.strokeDashArray || []);
    context.stroke();
    context.restore();
    const angle = Math.atan2(points.y2 - points.y1, points.x2 - points.x1);
    drawArrowHead(
      context,
      { x: points.x1, y: points.y1 },
      angle + Math.PI,
      formatting.startHead,
      this.stroke,
      this.strokeWidth
    );
    drawArrowHead(
      context,
      { x: points.x2, y: points.y2 },
      angle,
      formatting.endHead,
      this.stroke,
      this.strokeWidth
    );
  };
  object.canvasErdType = options.preview ? "arrow-preview" : "arrow";
  object.arrowId = arrow.id;
  return object;
}

function restackCanvasObjects() {
  canvas.getObjects()
    .map((object, index) => ({ object, index }))
    .sort((left, right) => {
      const layerDifference = CanvasERDDocument.canvasLayer(left.object.canvasErdType) -
        CanvasERDDocument.canvasLayer(right.object.canvasErdType);
      return layerDifference || left.index - right.index;
    })
    .forEach(({ object }, index) => canvas.moveObjectTo(object, index));
}

function renderArrows() {
  arrowObjects.forEach((object) => canvas.remove(object));
  arrowObjects.clear();
  state.arrows.forEach((arrow) => {
    const editable = !arrowMode && arrow.id !== editingArrowId;
    const object = createArrowObject(arrow, { selectable: editable, evented: editable });
    arrowObjects.set(arrow.id, object);
    canvas.add(object);
  });
  restackCanvasObjects();
  canvas.requestRenderAll();
}

function renderArrowPreview() {
  if (arrowPreview) canvas.remove(arrowPreview);
  arrowPreview = createArrowObject(drawingArrow, {
    stroke: "#2563eb",
    selectable: false,
    evented: false,
    preview: true
  });
  canvas.add(arrowPreview);
  canvas.requestRenderAll();
}

function setArrowMode(active) {
  if (active && frameMode) cancelFrameDrawing();
  if (active && editingArrowId) finishArrowEndpointEditing();
  arrowMode = active;
  arrowButton.setAttribute("aria-pressed", String(active));
  canvas.selection = !active;
  canvas.setCursor(active ? "crosshair" : "default");
  [
    ...frameObjects.values(),
    ...frameLabelObjects.values(),
    ...tableObjects.values(),
    ...noteObjects.values(),
    ...arrowObjects.values()
  ].forEach((object) => {
    object.selectable = !active;
    object.evented = !active;
  });
  if (active) canvas.discardActiveObject();
  canvas.requestRenderAll();
}

function cancelArrowDrawing() {
  if (arrowPreview) canvas.remove(arrowPreview);
  arrowPreview = null;
  drawingArrow = null;
  setArrowMode(false);
}

function finishArrowDrawing(eventData) {
  if (!drawingArrow) return;
  drawingArrow.end = arrowEndpoint(eventData);
  const distance = Math.hypot(
    drawingArrow.end.x - drawingArrow.start.x,
    drawingArrow.end.y - drawingArrow.start.y
  );
  if (arrowPreview) canvas.remove(arrowPreview);
  arrowPreview = null;

  if (distance >= 4) {
    state.arrows.push(drawingArrow);
    drawingArrow = null;
    renderArrows();
    setArrowMode(false);
    canvas.requestRenderAll();
    markDirty();
  } else {
    drawingArrow = null;
    setArrowMode(false);
  }
}

function updateArrowState(object) {
  const arrow = state.arrows.find((candidate) => candidate.id === object.arrowId);
  if (!arrow) return;
  const { start, end } = CanvasERDDocument.transformedArrowEndpoints(
    object.calcLinePoints(),
    object.calcTransformMatrix()
  );
  arrow.start = { x: start.x, y: start.y, attachment: null };
  arrow.end = { x: end.x, y: end.y, attachment: null };
  markDirty();
}

function createArrowEndpointHandle(arrow, endpointName) {
  const point = resolveArrowEndpoint(arrow[endpointName]);
  const handle = new fabric.Circle({
    left: point.x,
    top: point.y,
    originX: "center",
    originY: "center",
    radius: 7,
    fill: endpointName === "end" ? "#2563eb" : "#ffffff",
    stroke: "#2563eb",
    strokeWidth: 2,
    hasControls: false,
    hasBorders: false,
    objectCaching: false
  });
  handle.canvasErdType = "arrow-endpoint";
  handle.arrowId = arrow.id;
  handle.endpointName = endpointName;
  return handle;
}

function beginArrowEndpointEditing(arrowId) {
  if (arrowMode) cancelArrowDrawing();
  if (editingArrowId) finishArrowEndpointEditing();
  const arrow = state.arrows.find((candidate) => candidate.id === arrowId);
  const object = arrowObjects.get(arrowId);
  if (!arrow || !object) return;

  editingArrowId = arrowId;
  canvas.discardActiveObject();
  object.selectable = false;
  object.evented = false;
  ["start", "end"].forEach((endpointName) => {
    const handle = createArrowEndpointHandle(arrow, endpointName);
    arrowEndpointHandles.set(endpointName, handle);
    canvas.add(handle);
  });
  updateArrowFormattingControls();
  canvas.requestRenderAll();
}

function finishArrowEndpointEditing() {
  if (!editingArrowId) return;
  arrowEndpointHandles.forEach((handle) => canvas.remove(handle));
  arrowEndpointHandles.clear();
  const object = arrowObjects.get(editingArrowId);
  if (object) {
    object.selectable = true;
    object.evented = true;
  }
  editingArrowId = null;
  updateArrowFormattingControls();
  closeNoteFormattingMenus();
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

function updateArrowEndpointHandle(eventData) {
  const handle = eventData.target;
  const arrow = state.arrows.find((candidate) => candidate.id === handle.arrowId);
  if (!arrow) return;
  const point = eventData.pointer || { x: handle.left, y: handle.top };
  const target = eventData.e.ctrlKey ? null : attachableTargetAt(point);
  const endpoint = endpointAt(point, target, eventData.e.ctrlKey);
  arrow[handle.endpointName] = endpoint;
  handle.set({ left: endpoint.x, top: endpoint.y });
  handle.setCoords();
  renderArrows();
  markDirty();
}

function removeActiveArrows() {
  const active = canvas.getActiveObject();
  if (!active) return false;
  if (active.canvasErdType === "arrow-endpoint" && editingArrowId) {
    const arrowId = editingArrowId;
    finishArrowEndpointEditing();
    state.arrows = state.arrows.filter((arrow) => arrow.id !== arrowId);
    renderArrows();
    markDirty();
    return true;
  }
  const objects = active.canvasErdType === "arrow"
    ? [active]
    : (typeof active.getObjects === "function" ? active.getObjects() : []);
  const ids = objects.filter((object) => object.canvasErdType === "arrow").map((object) => object.arrowId);
  if (ids.length === 0) return false;

  const removed = new Set(ids);
  canvas.discardActiveObject();
  state.arrows = state.arrows.filter((arrow) => !removed.has(arrow.id));
  renderArrows();
  markDirty();
  return true;
}

function addNote(position = canvas.getVpCenter()) {
  if (frameMode) cancelFrameDrawing();
  if (arrowMode) cancelArrowDrawing();
  if (editingArrowId) finishArrowEndpointEditing();
  const origin = CanvasERDDocument.notePositionAt(position);
  const note = {
    id: globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}`,
    text: "Double-click to edit",
    x: origin.x,
    y: origin.y,
    width: 220,
    angle: 0,
    ...lastNoteFormatting
  };
  state.notes.push(note);

  const object = createNoteObject(note);
  noteObjects.set(note.id, object);
  canvas.add(object);
  restackCanvasObjects();
  canvas.setActiveObject(object);
  object.enterEditing();
  object.selectAll();
  updateNoteFormattingControls();
  canvas.requestRenderAll();
  markDirty();
}

function updateObjectState(object) {
  if (object.canvasErdType === "entity") {
    state.positions[object.entityId] = { x: object.left, y: object.top };
    scheduleRelationshipRender();
  } else if (object.canvasErdType === "note") {
    const note = state.notes.find((candidate) => candidate.id === object.noteId);
    if (!note) return;
    Object.assign(note, CanvasERDDocument.noteStateGeometry(object));
    scheduleRelationshipRender();
  } else if (object.canvasErdType === "frame") {
    const frame = state.frames.find((candidate) => candidate.id === object.frameId);
    if (!frame) return;
    Object.assign(frame, {
      x: object.left,
      y: object.top,
      width: object.width * object.scaleX,
      height: object.height * object.scaleY
    });
    const label = frameLabelObjects.get(frame.id);
    const position = CanvasERDDocument.frameLabelPosition(frame);
    label?.set({ left: position.x, top: position.y });
    label?.setCoords();
  } else if (object.canvasErdType === "frame-label") {
    const frame = state.frames.find((candidate) => candidate.id === object.frameId);
    if (!frame) return;
    frame.label = object.text;
  }
  markDirty();
}

function removeActiveFrame() {
  const active = canvas.getActiveObject();
  if (!["frame", "frame-label"].includes(active?.canvasErdType) || active.isEditing) return false;

  const frameId = active.frameId;
  canvas.discardActiveObject();
  canvas.remove(frameObjects.get(frameId), frameLabelObjects.get(frameId));
  frameObjects.delete(frameId);
  frameLabelObjects.delete(frameId);
  state.frames = state.frames.filter((frame) => frame.id !== frameId);
  markDirty();
  return true;
}

function removeActiveNote() {
  const active = canvas.getActiveObject();
  if (!active || active.canvasErdType !== "note" || active.isEditing) return false;

  state.arrows.forEach((arrow) => {
    [arrow.start, arrow.end].forEach((endpoint) => {
      if (endpoint.attachment?.type !== "note" || endpoint.attachment.id !== active.noteId) return;
      const point = resolveArrowEndpoint(endpoint);
      endpoint.x = point.x;
      endpoint.y = point.y;
      endpoint.attachment = null;
    });
  });
  canvas.discardActiveObject();
  canvas.remove(active);
  noteObjects.delete(active.noteId);
  state.notes = state.notes.filter((note) => note.id !== active.noteId);
  renderArrows();
  markDirty();
  return true;
}

function removeActiveTables() {
  const entityIds = CanvasERDDocument.selectedEntityIds(canvas.getActiveObject());
  if (entityIds.length === 0) return false;

  const removed = new Set(entityIds);
  canvas.discardActiveObject();
  state.includedEntityIds = state.includedEntityIds.filter((id) => !removed.has(id));
  document.querySelectorAll("[data-entity-id]").forEach((checkbox) => {
    if (removed.has(checkbox.dataset.entityId)) checkbox.checked = false;
  });
  renderTables();
  markDirty();
  return true;
}

function updateStatus() {
  if (!schema) return;
  const tables = state.includedEntityIds.length;
  const relationships = CanvasERDDocument.visibleRelationships(schema, state.includedEntityIds).length;
  statusElement.textContent = `${schema.name || "Rails application"} · ${tables} tables · ${relationships} relationships`;
}

function setAllTables(included) {
  state.includedEntityIds = included ? schema.entities.map((entity) => entity.id) : [];
  document.querySelectorAll("[data-entity-id]").forEach((checkbox) => {
    checkbox.checked = included;
  });
  renderTables();
  markDirty();
}

function renderTableList() {
  const fragment = document.createDocumentFragment();
  schema.entities.forEach((entity) => {
    const row = document.createElement("label");
    row.className = "table-option";
    row.dataset.search = `${entity.name} ${entity.table_name || ""}`.toLowerCase();

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.includedEntityIds.includes(entity.id);
    checkbox.dataset.entityId = entity.id;
    checkbox.addEventListener("change", () => {
      state = CanvasERDDocument.setEntityIncluded(state, entity.id, checkbox.checked);
      renderTables();
      markDirty();
    });

    const text = document.createElement("span");
    text.textContent = entity.label;
    row.append(checkbox, text);
    fragment.append(row);
  });
  tableListElement.replaceChildren(fragment);
}

function filterTableList() {
  const query = searchElement.value.trim().toLowerCase();
  tableListElement.querySelectorAll(".table-option").forEach((row) => {
    row.hidden = query !== "" && !row.dataset.search.includes(query);
  });
}

function showNotice(message, error = false) {
  clearTimeout(noticeTimer);
  noticeElement.textContent = message;
  noticeElement.classList.toggle("error", error);
  noticeElement.hidden = false;
  noticeTimer = setTimeout(() => { noticeElement.hidden = true; }, 5000);
}

async function refreshSchema() {
  refreshButton.disabled = true;
  refreshButton.setAttribute("aria-label", "Refreshing schema");
  refreshButton.title = "Refreshing schema";

  try {
    const response = await fetch("/api/schema?refresh=1", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const nextSchema = await response.json();
    const result = CanvasERDDocument.reconcileState(state, schema, nextSchema);
    schema = nextSchema;
    state = result.state;
    renderTableList();
    filterTableList();
    rebuildTables();
    applicationSchema = schema;
    markDirty();
    showNotice(CanvasERDDocument.changeSummary(result.changes));
  } catch (error) {
    showNotice(`Could not refresh schema: ${error.message}`, true);
  } finally {
    refreshButton.disabled = false;
    refreshButton.setAttribute("aria-label", "Refresh schema");
    refreshButton.title = "Refresh schema";
  }
}

function exportedPng() {
  const bounds = diagramBounds();
  const viewport = [...canvas.viewportTransform];
  const backgroundColor = canvas.backgroundColor;

  try {
    if (bounds) {
      const padding = 64;
      const width = Math.ceil(bounds.width + padding * 2);
      const height = Math.ceil(bounds.height + padding * 2);
      canvas.setViewportTransform([1, 0, 0, 1, padding - bounds.left, padding - bounds.top]);
      canvas.backgroundColor = "#f7f8fb";
      return canvas.toDataURL({
        format: "png",
        width,
        height,
        multiplier: CanvasERDPng.exportMultiplier(width, height)
      });
    }
    return canvas.toDataURL({ format: "png" });
  } finally {
    canvas.backgroundColor = backgroundColor;
    canvas.setViewportTransform(viewport);
    canvas.requestRenderAll();
  }
}

function diagramDocument() {
  return {
    format: "canvas_erd",
    version: 1,
    name: CanvasERDDocument.diagramName(diagramNameElement.value),
    schema,
    state: {
      ...state,
      viewportTransform: [...canvas.viewportTransform]
    }
  };
}

function embeddedDiagramPng() {
  const imageBytes = CanvasERDPng.bytesFromDataUrl(exportedPng());
  return CanvasERDPng.embedDocument(imageBytes, diagramDocument());
}

async function refreshSavedDiagrams(selectedName = currentDiagramFilename) {
  const response = await fetch("/api/diagrams", { cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());

  const result = await response.json();
  diagramsDirectory = result.directory;
  const selectedFilename = CanvasERDDocument.selectedDiagramFilename(selectedName, result.diagrams);
  const fragment = document.createDocumentFragment();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Untitled ERD";
  placeholder.selected = selectedFilename === "";
  fragment.append(placeholder);
  result.diagrams.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = CanvasERDDocument.diagramName(name);
    fragment.append(option);
  });
  savedDiagramsElement.replaceChildren(fragment);
  savedDiagramsElement.value = selectedFilename;
}

async function saveDiagram() {
  if (!changeTracker.isDirty() || isSaving) return;
  if (editingArrowId) finishArrowEndpointEditing();

  const requestedName = diagramNameElement.value.trim();
  if (!requestedName) {
    showNotice("Enter a diagram name before saving.", true);
    diagramNameElement.focus();
    return;
  }

  const filename = CanvasERDDocument.erdFilename(requestedName);
  isSaving = true;
  updateSaveButton();

  try {
    const png = embeddedDiagramPng();
    changeTracker.markClean();
    const response = await fetch(`/api/diagram?name=${encodeURIComponent(filename)}`, {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: png
    });
    if (!response.ok) throw new Error(await response.text());

    currentDiagramFilename = filename;
    setDiagramName(filename);
    await refreshSavedDiagrams(filename);
    showNotice(`Saved ${diagramsDirectory}/${filename}.`);
  } catch (error) {
    markDirty();
    showNotice(`Could not save diagram: ${error.message}`, true);
  } finally {
    isSaving = false;
    updateSaveButton();
  }
}

function displayDocument(documentData) {
  schema = documentData.schema;
  state = {
    ...documentData.state,
    arrows: documentData.state.arrows || [],
    frames: documentData.state.frames || [],
    tableHeaderColors: documentData.state.tableHeaderColors || {}
  };
  if (frameMode) cancelFrameDrawing();
  if (arrowMode) cancelArrowDrawing();
  if (editingArrowId) finishArrowEndpointEditing();
  canvas.discardActiveObject();
  canvas.clear();
  tableObjects.clear();
  relationshipObjects = [];
  noteObjects.clear();
  arrowObjects.clear();
  frameObjects.clear();
  frameLabelObjects.clear();
  renderTableList();
  renderFrames();
  renderTables();
  renderNotes();
  renderArrows();

  if (Array.isArray(state.viewportTransform) && state.viewportTransform.length === 6) {
    canvas.setViewportTransform(state.viewportTransform);
    updateZoomDependentObjects();
    canvas.requestRenderAll();
  } else {
    fitDiagram(false);
  }
}

function confirmDiscardChanges() {
  return CanvasERDDocument.confirmDiscardChanges(
    changeTracker.isDirty(),
    (message) => globalThis.confirm(message)
  );
}

async function loadDiagram(filename) {
  if (!filename) return;

  const previousFilename = currentDiagramFilename;
  savedDiagramsElement.disabled = true;
  try {
    const response = await fetch(`/api/diagram?name=${encodeURIComponent(filename)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());

    const documentData = CanvasERDPng.extractDocument(new Uint8Array(await response.arrayBuffer()));
    displayDocument(documentData);
    currentDiagramFilename = filename;
    setDiagramName(documentData.name || filename);
    changeTracker.markClean();
    showNotice(`Loaded ${diagramsDirectory}/${filename}.`);
  } catch (error) {
    savedDiagramsElement.value = previousFilename || "";
    showNotice(`Could not load diagram: ${error.message}`, true);
  } finally {
    savedDiagramsElement.disabled = false;
  }
}

async function newDiagram() {
  if (newButton.disabled || !confirmDiscardChanges()) return;

  newButton.disabled = true;
  loadingElement.textContent = "Laying out diagram…";
  loadingElement.hidden = false;
  try {
    const initialState = await createInitialState(applicationSchema);
    currentDiagramFilename = null;
    savedDiagramsElement.value = "";
    showSavedDiagrams(false);
    setDiagramName("Untitled ERD");
    displayDocument({ schema: applicationSchema, state: initialState });
    changeTracker.markClean();
  } finally {
    newButton.disabled = false;
    loadingElement.hidden = true;
  }
}

function diagramBounds() {
  const objects = [
    ...frameObjects.values(),
    ...frameLabelObjects.values(),
    ...tableObjects.values(),
    ...noteObjects.values(),
    ...arrowObjects.values(),
    ...relationshipObjects
  ];
  if (objects.length === 0) return null;

  return objects.map((object) => object.getBoundingRect()).reduce((bounds, object) => {
    const left = Math.min(bounds.left, object.left);
    const top = Math.min(bounds.top, object.top);
    const right = Math.max(bounds.left + bounds.width, object.left + object.width);
    const bottom = Math.max(bounds.top + bounds.height, object.top + object.height);
    return { left, top, width: right - left, height: bottom - top };
  });
}

function fitDiagram(trackChange = true) {
  const transform = CanvasERDDocument.fitViewport(
    diagramBounds(),
    { width: canvas.width, height: canvas.height }
  );
  canvas.setViewportTransform(transform);
  updateZoomDependentObjects();
  canvas.requestRenderAll();
  if (trackChange) markDirty();
}

function zoom(multiplier) {
  const nextZoom = Math.min(2.5, Math.max(0.15, canvas.getZoom() * multiplier));
  canvas.zoomToPoint(canvas.getCenterPoint(), nextZoom);
  updateZoomDependentObjects();
  canvas.requestRenderAll();
  markDirty();
}

function resizeCanvas() {
  const bounds = panelElement.getBoundingClientRect();
  canvas.setDimensions({
    width: Math.max(1, Math.floor(bounds.width)),
    height: Math.max(1, Math.floor(bounds.height))
  });
}

function configureCanvasEvents() {
  const selectionChanged = () => {
    closeNoteFormattingMenus();
    updateNoteFormattingControls();
    updateTableFormattingControls();
    updateFrameFormattingControls();
  };
  canvas.on("selection:created", selectionChanged);
  canvas.on("selection:updated", selectionChanged);
  canvas.on("selection:cleared", selectionChanged);
  canvas.on("mouse:down", ({ target }) => {
    if (editingArrowId && target?.canvasErdType !== "arrow-endpoint") finishArrowEndpointEditing();
    const arrowId = CanvasERDDocument.arrowIdForEndpointEditing(target);
    if (arrowId) beginArrowEndpointEditing(arrowId);
  });
  canvas.on("mouse:down", (eventData) => {
    if (!arrowMode || spacePressed) return;
    drawingArrow = {
      id: globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `arrow-${Date.now()}`,
      start: arrowEndpoint(eventData),
      end: arrowEndpoint(eventData),
      ...CanvasERDDocument.DEFAULT_ARROW_FORMATTING
    };
    renderArrowPreview();
  });
  canvas.on("mouse:move", (eventData) => {
    if (!arrowMode || !drawingArrow) return;
    drawingArrow.end = arrowEndpoint(eventData);
    renderArrowPreview();
  });
  canvas.on("mouse:up", (eventData) => {
    if (arrowMode && drawingArrow) finishArrowDrawing(eventData);
  });
  canvas.on("mouse:down", ({ e, scenePoint }) => {
    if (!frameMode || spacePressed) return;
    const point = scenePoint || canvas.getScenePoint(e);
    drawingFrame = { start: { x: point.x, y: point.y }, end: { x: point.x, y: point.y } };
    renderFramePreview();
  });
  canvas.on("mouse:move", ({ e, scenePoint }) => {
    if (!frameMode || !drawingFrame) return;
    const point = scenePoint || canvas.getScenePoint(e);
    drawingFrame.end = { x: point.x, y: point.y };
    renderFramePreview();
  });
  canvas.on("mouse:up", ({ e, scenePoint }) => {
    if (!frameMode || !drawingFrame) return;
    const point = scenePoint || canvas.getScenePoint(e);
    finishFrameDrawing({ x: point.x, y: point.y });
  });

  canvas.on("object:moving", (eventData) => {
    if (eventData.target.canvasErdType === "arrow-endpoint") updateArrowEndpointHandle(eventData);
    else if (eventData.target.canvasErdType !== "arrow") updateObjectState(eventData.target);
  });
  canvas.on("object:scaling", ({ target }) => {
    if (target.canvasErdType === "frame") updateObjectState(target);
  });
  canvas.on("object:modified", (eventData) => {
    if (eventData.target.canvasErdType === "arrow") updateArrowState(eventData.target);
    else if (eventData.target.canvasErdType === "arrow-endpoint") updateArrowEndpointHandle(eventData);
    else updateObjectState(eventData.target);
  });
  canvas.on("text:changed", ({ target }) => updateObjectState(target));

  canvas.on("mouse:wheel", ({ e }) => {
    if (e.ctrlKey) {
      panQuality.finish();
      const nextZoom = CanvasERDDocument.zoomForWheel(canvas.getZoom(), e.deltaY);
      canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), nextZoom);
      updateZoomDependentObjects();
      canvas.requestRenderAll();
      markDirty();
    } else {
      panQuality.begin();
      scheduleViewportPan(e.deltaX, e.deltaY);
    }
    e.preventDefault();
    e.stopPropagation();
  });

  canvas.on("mouse:down", ({ e, scenePoint }) => {
    const point = scenePoint || canvas.getScenePoint(e);
    lastCanvasPointer = { x: point.x, y: point.y };
    if (!spacePressed) return;
    isPanning = true;
    panQuality.begin();
    lastPointer = { x: e.clientX, y: e.clientY };
    canvas.selection = false;
    canvas.setCursor("grabbing");
  });

  canvas.on("mouse:move", ({ e, scenePoint }) => {
    const point = scenePoint || canvas.getScenePoint(e);
    lastCanvasPointer = { x: point.x, y: point.y };
    if (!isPanning) return;
    panQuality.begin();
    const transform = [...canvas.viewportTransform];
    transform[4] += e.clientX - lastPointer.x;
    transform[5] += e.clientY - lastPointer.y;
    canvas.setViewportTransform(transform);
    lastPointer = { x: e.clientX, y: e.clientY };
    markDirty();
  });

  canvas.on("mouse:up", () => {
    if (isPanning) panQuality.finish();
    isPanning = false;
    lastPointer = null;
    canvas.selection = true;
    canvas.setCursor(spacePressed ? "grab" : "default");
  });

  document.addEventListener("keydown", (event) => {
    const editing = canvas.getActiveObject() && canvas.getActiveObject().isEditing;
    const acceptsText = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable;
    const noteFormatting = CanvasERDDocument.noteFormattingShortcut(event);
    const action = CanvasERDDocument.shortcutAction(event);
    const bareAction = ["addNote", "arrow", "toggleTables", "layoutTables", "zoomIn", "zoomOut", "fit", "help"].includes(action);

    if (noteFormatting && activeNoteObject() && (!acceptsText || editing)) {
      event.preventDefault();
      if (!event.repeat) {
        if (CanvasERDDocument.NOTE_PARAGRAPH_STYLES[noteFormatting]) {
          applyNoteFormatting(CanvasERDDocument.noteParagraphStyleFormatting(noteFormatting));
        } else {
          toggleNoteFormatting(noteFormatting);
        }
      }
      return;
    }

    if (action && (!bareAction || (!editing && !acceptsText))) {
      event.preventDefault();
      if (event.repeat) return;

      if (action === "save") {
        finishNameEditing();
        saveDiagram();
      } else if (action === "open") {
        finishNameEditing();
        openSavedDiagrams();
      } else if (action === "new") {
        finishNameEditing();
        newDiagram();
      } else if (action === "addNote") {
        addNote(lastCanvasPointer || canvas.getVpCenter());
      } else if (action === "arrow") {
        if (arrowMode) cancelArrowDrawing();
        else setArrowMode(true);
      } else if (action === "toggleTables") {
        setTablesCollapsed(!tablesSidebarElement.classList.contains("collapsed"));
      } else if (action === "layoutTables") {
        layoutTables();
      } else if (action === "zoomIn") {
        zoom(1.2);
      } else if (action === "zoomOut") {
        zoom(1 / 1.2);
      } else if (action === "fit") {
        fitDiagram();
      } else if (action === "help") {
        showShortcutHelp(shortcutPanelElement.hidden);
      }
      return;
    }

    if (event.key === "Escape" && closeNoteFormattingMenus()) {
      event.preventDefault();
    } else if (event.key === "Escape" && editingArrowId) {
      event.preventDefault();
      finishArrowEndpointEditing();
    } else if (event.key === "Escape" && arrowMode) {
      event.preventDefault();
      cancelArrowDrawing();
    } else if (event.key === "Escape" && frameMode) {
      event.preventDefault();
      cancelFrameDrawing();
    } else if (event.key === "Escape" && !shortcutPanelElement.hidden) {
      event.preventDefault();
      showShortcutHelp(false);
    } else if (event.code === "Space" && !editing && !acceptsText) {
      event.preventDefault();
      spacePressed = true;
      canvas.skipTargetFind = true;
      canvas.setCursor("grab");
    } else if (["Delete", "Backspace"].includes(event.key) && (
      removeActiveTables() || removeActiveArrows() || removeActiveFrame() || removeActiveNote()
    )) {
      event.preventDefault();
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.code !== "Space") return;
    spacePressed = false;
    isPanning = false;
    canvas.skipTargetFind = false;
    canvas.selection = !arrowMode && !frameMode;
    canvas.setCursor(arrowMode || frameMode ? "crosshair" : "default");
  });
}

function configureControls() {
  refreshButton.addEventListener("click", refreshSchema);
  toggleTablesButton.addEventListener("click", () => {
    setTablesCollapsed(!tablesSidebarElement.classList.contains("collapsed"));
  });
  arrowButton.addEventListener("click", () => {
    if (arrowMode) cancelArrowDrawing();
    else setArrowMode(true);
  });
  frameButton.addEventListener("click", () => {
    if (frameMode) cancelFrameDrawing();
    else setFrameMode(true);
  });
  saveButton.addEventListener("click", saveDiagram);
  newButton.addEventListener("click", newDiagram);
  openButton.addEventListener("click", () => {
    if (savedDiagramsElement.hidden) openSavedDiagrams();
    else showSavedDiagrams(false);
  });
  shortcutHelpButton.addEventListener("click", () => showShortcutHelp(shortcutPanelElement.hidden));
  editNameButton.addEventListener("click", beginNameEditing);
  diagramNameElement.addEventListener("blur", () => finishNameEditing());
  diagramNameElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishNameEditing();
    } else if (event.key === "Escape") {
      event.preventDefault();
      finishNameEditing(true);
    }
  });
  savedDiagramsElement.addEventListener("change", async () => {
    const filename = savedDiagramsElement.value;
    showSavedDiagrams(false);
    if (!filename) {
      savedDiagramsElement.value = currentDiagramFilename || "";
      return;
    }
    if (!confirmDiscardChanges()) {
      savedDiagramsElement.value = currentDiagramFilename || "";
      return;
    }
    await loadDiagram(filename);
  });
  document.querySelector("#add-note").addEventListener("click", () => addNote());
  layoutTablesButton.addEventListener("click", layoutTables);
  document.querySelector("#zoom-in").addEventListener("click", () => zoom(1.2));
  document.querySelector("#zoom-out").addEventListener("click", () => zoom(1 / 1.2));
  document.querySelector("#reset-view").addEventListener("click", fitDiagram);
  document.querySelector("#select-all").addEventListener("click", () => setAllTables(true));
  document.querySelector("#select-none").addEventListener("click", () => setAllTables(false));
  searchElement.addEventListener("input", filterTableList);
  noteBoldButton.addEventListener("click", () => toggleNoteFormatting("bold"));
  noteItalicButton.addEventListener("click", () => toggleNoteFormatting("italic"));
  noteUnderlineButton.addEventListener("click", () => toggleNoteFormatting("underline"));
  noteColorControls.forEach((control) => {
    control.button.addEventListener("click", () => toggleNoteColorMenu(control));
    control.custom.addEventListener("change", () => {
      applyNoteFormatting({ [control.property]: control.custom.value });
      closeNoteFormattingMenus();
    });
    control.transparent?.addEventListener("click", () => {
      applyNoteFormatting({ [control.property]: "transparent" });
      closeNoteFormattingMenus();
    });
  });
  tableHeaderColorControl.button.addEventListener("click", toggleTableHeaderColorMenu);
  tableHeaderColorControl.custom.addEventListener("change", () => {
    applyTableHeaderColor(tableHeaderColorControl.custom.value);
    closeNoteFormattingMenus();
  });
  arrowColorControl.button.addEventListener("click", toggleArrowColorMenu);
  arrowColorControl.custom.addEventListener("change", () => {
    applyArrowFormatting({ color: arrowColorControl.custom.value });
    closeNoteFormattingMenus();
  });
  arrowStartHeadElement.addEventListener("change", () => {
    applyArrowFormatting({ startHead: arrowStartHeadElement.value });
  });
  arrowEndHeadElement.addEventListener("change", () => {
    applyArrowFormatting({ endHead: arrowEndHeadElement.value });
  });
  arrowLineStyleElement.addEventListener("change", () => {
    applyArrowFormatting({ lineStyle: arrowLineStyleElement.value });
  });
  arrowStrokeWidthElement.addEventListener("change", () => {
    applyArrowFormatting({ strokeWidth: arrowStrokeWidthElement.value });
  });
  frameColorControl.button.addEventListener("click", toggleFrameColorMenu);
  frameColorControl.custom.addEventListener("change", () => {
    applyFrameFormatting({ color: frameColorControl.custom.value });
    closeNoteFormattingMenus();
  });
  frameLineStyleElement.addEventListener("change", () => {
    applyFrameFormatting({ lineStyle: frameLineStyleElement.value });
  });
  document.addEventListener("pointerdown", (event) => {
    const insideFormatting = noteFormattingElement.contains(event.target) ||
      tableFormattingElement.contains(event.target) ||
      arrowFormattingElement.contains(event.target) ||
      frameFormattingElement.contains(event.target);
    if (!insideFormatting) closeNoteFormattingMenus();
  });
  noteParagraphStyleElement.addEventListener("change", () => {
    applyNoteFormatting(
      CanvasERDDocument.noteParagraphStyleFormatting(noteParagraphStyleElement.value)
    );
  });
  noteAlignmentElement.addEventListener("change", () => {
    applyNoteFormatting({ textAlign: noteAlignmentElement.value });
  });
}

function initializeEditor(loadedDocument) {
  schema = loadedDocument.schema;
  applicationSchema = loadedDocument.application_schema || schema;
  currentDiagramFilename = loadedDocument.filename || null;
  state = loadedDocument.state || CanvasERDDocument.createState(schema);
  state = {
    ...state,
    arrows: state.arrows || [],
    frames: state.frames || [],
    tableHeaderColors: state.tableHeaderColors || {}
  };
  setDiagramName(loadedDocument.name);
  canvas = new fabric.Canvas("erd-canvas", {
    backgroundColor: "transparent",
    preserveObjectStacking: true,
    targetFindTolerance: 5,
    selectionColor: "rgba(37, 99, 235, 0.08)",
    selectionBorderColor: "#2563eb"
  });

  resizeCanvas();
  configureCanvasEvents();
  configureControls();
  renderTableList();
  renderFrames();
  renderTables();
  renderNotes();
  renderArrows();
  if (Array.isArray(state.viewportTransform) && state.viewportTransform.length === 6) {
    canvas.setViewportTransform(state.viewportTransform);
    updateZoomDependentObjects();
  } else {
    fitDiagram(false);
  }
  new ResizeObserver(resizeCanvas).observe(panelElement);
  refreshSavedDiagrams(currentDiagramFilename)
    .catch((error) => showNotice(`Could not list diagrams: ${error.message}`, true));
  loadingElement.hidden = true;
}

fetch("/api/document", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(async (loadedDocument) => {
    if (!loadedDocument.state) loadedDocument.state = await createInitialState(loadedDocument.schema);
    return loadedDocument;
  })
  .then(initializeEditor)
  .catch((error) => {
    statusElement.textContent = "Could not load the Rails ERD schema";
    loadingElement.textContent = error.message;
    loadingElement.classList.add("error");
  });
