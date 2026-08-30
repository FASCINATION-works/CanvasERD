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
let noticeTimer;
let currentDiagramFilename = null;
let diagramsDirectory = "docs/erd";
let isSaving = false;
let isEditingName = false;
let nameBeforeEditing = "Untitled ERD";
const changeTracker = CanvasERDDocument.createChangeTracker(updateSaveButton);

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
      fill: "#243b63",
      rx: 8,
      ry: 8
    })),
    new fabric.Rect(CanvasERDDocument.topLeft({
      left: 0,
      top: CanvasERDDocument.HEADER_HEIGHT - 8,
      width,
      height: 8,
      fill: "#243b63"
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

function createRelationshipObjects(relationship, source, destination) {
  const sourceBounds = tableBounds(source);
  const destinationBounds = tableBounds(destination);
  const style = relationStyle(relationship);
  let connector;
  let labelPosition;

  if (source === destination) {
    const right = sourceBounds.left + sourceBounds.width;
    const top = sourceBounds.top;
    const centerY = top + sourceBounds.height / 2;
    const points = [
      { x: right, y: centerY },
      { x: right + 44, y: centerY },
      { x: right + 44, y: top - 34 },
      { x: right - 20, y: top - 34 },
      { x: right - 20, y: top }
    ];
    connector = new fabric.Polyline(points, style);
    labelPosition = { x: right + 48, y: top - 28 };
  } else {
    const sourceCenter = {
      x: sourceBounds.left + sourceBounds.width / 2,
      y: sourceBounds.top + sourceBounds.height / 2
    };
    const destinationCenter = {
      x: destinationBounds.left + destinationBounds.width / 2,
      y: destinationBounds.top + destinationBounds.height / 2
    };
    connector = new fabric.Line([
      sourceCenter.x,
      sourceCenter.y,
      destinationCenter.x,
      destinationCenter.y
    ], style);
    labelPosition = {
      x: (sourceCenter.x + destinationCenter.x) / 2,
      y: (sourceCenter.y + destinationCenter.y) / 2
    };
  }

  connector.canvasErdType = "relationship";
  const label = new fabric.FabricText(CanvasERDDocument.cardinalityLabel(relationship), {
    left: labelPosition.x,
    top: labelPosition.y,
    originX: "center",
    originY: "center",
    fontFamily: CanvasERDDocument.CANVAS_FONT_FAMILY,
    fontSize: 10,
    fill: "#526277",
    backgroundColor: "#f7f8fb",
    selectable: false,
    evented: false
  });
  label.canvasErdType = "relationship";
  return [connector, label];
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

  [...relationshipObjects].reverse().forEach((object) => canvas.sendObjectToBack(object));
  canvas.requestRenderAll();
  updateStatus();
}

function scheduleRelationshipRender() {
  if (relationFrame) return;
  relationFrame = requestAnimationFrame(() => {
    relationFrame = null;
    renderRelationships();
  });
}

function renderTables() {
  const included = new Set(state.includedEntityIds);
  schema.entities.forEach((entity) => {
    if (included.has(entity.id)) addTable(entity);
    else removeTable(entity.id);
  });
  renderRelationships();
}

function rebuildTables() {
  relationshipObjects.forEach((object) => canvas.remove(object));
  relationshipObjects = [];
  tableObjects.forEach((object) => canvas.remove(object));
  tableObjects.clear();
  renderTables();
}

function createNoteObject(note) {
  const object = new fabric.Textbox(note.text, CanvasERDDocument.uncachedText({
    left: note.x,
    top: note.y,
    width: note.width,
    fill: "#4a3f12",
    backgroundColor: "#fff2a8",
    fontFamily: CanvasERDDocument.CANVAS_FONT_FAMILY,
    fontSize: 15,
    lineHeight: 1.25,
    padding: 12,
    borderColor: "#d09b16",
    editingBorderColor: "#d09b16",
    cornerColor: "#d09b16",
    transparentCorners: false,
    lockScalingY: true
  }));
  object._renderBackground = function (context) {
    if (!this.backgroundColor) return;

    const dimensions = this._getNonTransformedDimensions();
    const bounds = CanvasERDDocument.paddedBackgroundBounds(dimensions.x, dimensions.y, this.padding);
    context.fillStyle = this.backgroundColor;
    context.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    this._removeShadow(context);
  };
  object.canvasErdType = "note";
  object.noteId = note.id;
  return object;
}

function renderNotes() {
  state.notes.forEach((note) => {
    const object = createNoteObject(note);
    noteObjects.set(note.id, object);
    canvas.add(object);
  });
}

function addNote(position = canvas.getVpCenter()) {
  const origin = CanvasERDDocument.notePositionAt(position);
  const note = {
    id: globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}`,
    text: "Double-click to edit",
    x: origin.x,
    y: origin.y,
    width: 220
  };
  state.notes.push(note);

  const object = createNoteObject(note);
  noteObjects.set(note.id, object);
  canvas.add(object);
  canvas.setActiveObject(object);
  object.enterEditing();
  object.selectAll();
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
    note.x = object.left;
    note.y = object.top;
    note.width = object.width * object.scaleX;
    note.text = object.text;
  }
  markDirty();
}

function removeActiveNote() {
  const active = canvas.getActiveObject();
  if (!active || active.canvasErdType !== "note" || active.isEditing) return false;

  canvas.remove(active);
  noteObjects.delete(active.noteId);
  state.notes = state.notes.filter((note) => note.id !== active.noteId);
  canvas.requestRenderAll();
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
      canvas.setViewportTransform([1, 0, 0, 1, padding - bounds.left, padding - bounds.top]);
      canvas.backgroundColor = "#f7f8fb";
      return canvas.toDataURL({
        format: "png",
        width: Math.ceil(bounds.width + padding * 2),
        height: Math.ceil(bounds.height + padding * 2)
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
  state = documentData.state;
  canvas.discardActiveObject();
  canvas.clear();
  tableObjects.clear();
  relationshipObjects = [];
  noteObjects.clear();
  renderTableList();
  renderTables();
  renderNotes();

  if (Array.isArray(state.viewportTransform) && state.viewportTransform.length === 6) {
    canvas.setViewportTransform(state.viewportTransform);
    updateTableCaching();
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

function newDiagram() {
  if (!confirmDiscardChanges()) return;

  currentDiagramFilename = null;
  savedDiagramsElement.value = "";
  showSavedDiagrams(false);
  setDiagramName("Untitled ERD");
  displayDocument({ schema: applicationSchema, state: CanvasERDDocument.createState(applicationSchema) });
  changeTracker.markClean();
}

function diagramBounds() {
  const objects = [
    ...tableObjects.values(),
    ...noteObjects.values(),
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
  updateTableCaching();
  canvas.requestRenderAll();
  if (trackChange) markDirty();
}

function zoom(multiplier) {
  const nextZoom = Math.min(2.5, Math.max(0.15, canvas.getZoom() * multiplier));
  canvas.zoomToPoint(canvas.getCenterPoint(), nextZoom);
  updateTableCaching();
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
  canvas.on("object:moving", ({ target }) => updateObjectState(target));
  canvas.on("object:modified", ({ target }) => updateObjectState(target));
  canvas.on("text:changed", ({ target }) => updateObjectState(target));

  canvas.on("mouse:wheel", ({ e }) => {
    if (e.ctrlKey) {
      panQuality.finish();
      const nextZoom = CanvasERDDocument.zoomForWheel(canvas.getZoom(), e.deltaY);
      canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), nextZoom);
      updateTableCaching();
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
    const action = CanvasERDDocument.shortcutAction(event);
    const bareAction = ["addNote", "toggleTables", "zoomIn", "zoomOut", "fit", "help"].includes(action);

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
      } else if (action === "toggleTables") {
        setTablesCollapsed(!tablesSidebarElement.classList.contains("collapsed"));
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

    if (event.key === "Escape" && !shortcutPanelElement.hidden) {
      event.preventDefault();
      showShortcutHelp(false);
    } else if (event.code === "Space" && !editing && !acceptsText) {
      event.preventDefault();
      spacePressed = true;
      canvas.skipTargetFind = true;
      canvas.setCursor("grab");
    } else if (["Delete", "Backspace"].includes(event.key) && (removeActiveTables() || removeActiveNote())) {
      event.preventDefault();
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.code !== "Space") return;
    spacePressed = false;
    isPanning = false;
    canvas.skipTargetFind = false;
    canvas.selection = true;
    canvas.setCursor("default");
  });
}

function configureControls() {
  refreshButton.addEventListener("click", refreshSchema);
  toggleTablesButton.addEventListener("click", () => {
    setTablesCollapsed(!tablesSidebarElement.classList.contains("collapsed"));
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
  document.querySelector("#zoom-in").addEventListener("click", () => zoom(1.2));
  document.querySelector("#zoom-out").addEventListener("click", () => zoom(1 / 1.2));
  document.querySelector("#reset-view").addEventListener("click", fitDiagram);
  document.querySelector("#select-all").addEventListener("click", () => setAllTables(true));
  document.querySelector("#select-none").addEventListener("click", () => setAllTables(false));
  searchElement.addEventListener("input", filterTableList);
}

function initializeEditor(loadedDocument) {
  schema = loadedDocument.schema;
  applicationSchema = schema;
  state = loadedDocument.state || CanvasERDDocument.createState(schema);
  setDiagramName(loadedDocument.name);
  canvas = new fabric.Canvas("erd-canvas", {
    backgroundColor: "transparent",
    preserveObjectStacking: true,
    selectionColor: "rgba(37, 99, 235, 0.08)",
    selectionBorderColor: "#2563eb"
  });

  resizeCanvas();
  configureCanvasEvents();
  configureControls();
  renderTableList();
  renderTables();
  renderNotes();
  if (Array.isArray(state.viewportTransform) && state.viewportTransform.length === 6) {
    canvas.setViewportTransform(state.viewportTransform);
    updateTableCaching();
  } else {
    fitDiagram(false);
  }
  new ResizeObserver(resizeCanvas).observe(panelElement);
  refreshSavedDiagrams().catch((error) => showNotice(`Could not list diagrams: ${error.message}`, true));
  loadingElement.hidden = true;
}

fetch("/api/document", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(initializeEditor)
  .catch((error) => {
    statusElement.textContent = "Could not load the Rails ERD schema";
    loadingElement.textContent = error.message;
    loadingElement.classList.add("error");
  });
