"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const documentModel = require("../../lib/canvas_erd/web/document.js");

test("uses a concrete canvas font for stable Fabric text measurement", () => {
  assert.equal(documentModel.CANVAS_FONT_FAMILY, "Arial");
});

const entities = [
  { id: "Book", attributes: [{}, {}] },
  { id: "Author", attributes: [{}] },
  { id: "Review", attributes: [] }
];

test("uses explicit top-left origins for card geometry", () => {
  assert.deepEqual(
    documentModel.topLeft({ top: 12, originX: "right" }),
    { originX: "right", originY: "top", top: 12 }
  );
});

test("renders canvas text without a glyph-clipping object cache", () => {
  assert.deepEqual(
    documentModel.uncachedText({ top: 12, objectCaching: true }),
    { originX: "left", originY: "top", top: 12, objectCaching: false }
  );
});

test("expands a note background around its text", () => {
  assert.deepEqual(
    documentModel.paddedBackgroundBounds(220, 40, 12),
    { left: -122, top: -32, width: 244, height: 64 }
  );
});

test("uses the editable diagram filename extension", () => {
  assert.equal(documentModel.erdFilename("domain"), "domain.erd.png");
  assert.equal(documentModel.erdFilename("domain.png"), "domain.erd.png");
  assert.equal(documentModel.erdFilename("domain.erd.png"), "domain.erd.png");
  assert.equal(documentModel.erdFilename(""), "diagram.erd.png");
});

test("derives an editable diagram name from a saved filename", () => {
  assert.equal(documentModel.diagramName("Domain model.erd.png"), "Domain model");
  assert.equal(documentModel.diagramName("Domain model.png"), "Domain model");
  assert.equal(documentModel.diagramName(""), "Untitled ERD");
});

test("confirms before discarding unsaved changes", () => {
  let confirmations = 0;
  const confirmDiscard = () => { confirmations += 1; return false; };

  assert.equal(documentModel.confirmDiscardChanges(false, confirmDiscard), true);
  assert.equal(confirmations, 0);
  assert.equal(documentModel.confirmDiscardChanges(true, confirmDiscard), false);
  assert.equal(confirmations, 1);
});

test("recognizes the platform save shortcuts", () => {
  assert.equal(documentModel.isSaveShortcut({ key: "s", metaKey: true, ctrlKey: false }), true);
  assert.equal(documentModel.isSaveShortcut({ key: "S", metaKey: false, ctrlKey: true }), true);
  assert.equal(documentModel.isSaveShortcut({ key: "s", metaKey: false, ctrlKey: false }), false);
});

test("maps editor keyboard shortcuts to actions", () => {
  assert.equal(documentModel.shortcutAction({ key: "o", metaKey: true }), "open");
  assert.equal(documentModel.shortcutAction({ key: "n", ctrlKey: true }), "new");
  assert.equal(documentModel.shortcutAction({ key: "n" }), "addNote");
  assert.equal(documentModel.shortcutAction({ key: "t" }), "toggleTables");
  assert.equal(documentModel.shortcutAction({ key: "?", shiftKey: true }), "help");
  assert.equal(documentModel.shortcutAction({ key: "n", altKey: true }), null);
});

test("centers a keyboard-created note at the canvas pointer", () => {
  assert.deepEqual(documentModel.notePositionAt({ x: 500, y: 400 }), { x: 390, y: 355 });
});

test("selects only the diagram that is actually loaded", () => {
  const diagrams = ["Domain.erd.png"];

  assert.equal(documentModel.selectedDiagramFilename(null, diagrams), "");
  assert.equal(documentModel.selectedDiagramFilename("Domain.erd.png", diagrams), "Domain.erd.png");
});

test("tracks whether the diagram has unsaved changes", () => {
  const changes = [];
  const tracker = documentModel.createChangeTracker((dirty) => changes.push(dirty));

  assert.equal(tracker.isDirty(), false);
  tracker.markDirty();
  tracker.markDirty();
  assert.equal(tracker.isDirty(), true);
  tracker.markClean();
  assert.equal(tracker.isDirty(), false);
  assert.deepEqual(changes, [true, false]);
});

test("lays entities out deterministically without overlap", () => {
  const positions = documentModel.layoutEntities(entities, { columns: 2, margin: 20, gapX: 40, gapY: 30 });

  assert.deepEqual(Object.keys(positions), ["Author", "Book", "Review"]);
  assert.deepEqual(positions.Author, { x: 20, y: 20 });
  assert.deepEqual(positions.Book, { x: 360, y: 20 });
  assert.ok(positions.Review.y > positions.Author.y + documentModel.tableHeight(entities[1]));
});

test("removing and restoring an entity preserves its position", () => {
  const schema = { entities, relationships: [] };
  const original = documentModel.createState(schema);
  const removed = documentModel.setEntityIncluded(original, "Book", false);
  const restored = documentModel.setEntityIncluded(removed, "Book", true);

  assert.equal(removed.includedEntityIds.includes("Book"), false);
  assert.equal(restored.includedEntityIds.includes("Book"), true);
  assert.equal(restored.positions, original.positions);
});

test("finds tables in single and multiple selections", () => {
  const book = { canvasErdType: "entity", entityId: "Book", getObjects: () => [{ canvasErdType: "text" }] };
  const author = { canvasErdType: "entity", entityId: "Author" };
  const note = { canvasErdType: "note" };

  assert.deepEqual(documentModel.selectedEntityIds(book), ["Book"]);
  assert.deepEqual(
    documentModel.selectedEntityIds({ getObjects: () => [book, note, author] }),
    ["Book", "Author"]
  );
  assert.deepEqual(documentModel.selectedEntityIds(note), []);
});

test("reconciles schema changes without losing diagram edits", () => {
  const previousSchema = {
    entities: [
      { id: "Author", attributes: [{ name: "name" }] },
      { id: "Book", attributes: [{ name: "title" }] }
    ],
    relationships: [{ id: "author-books" }],
    specializations: []
  };
  const nextSchema = {
    entities: [
      { id: "Author", attributes: [{ name: "full_name" }] },
      { id: "Review", attributes: [] }
    ],
    relationships: [{ id: "author-reviews" }],
    specializations: []
  };
  const state = {
    includedEntityIds: ["Author", "Book"],
    positions: { Author: { x: 800, y: 400 }, Book: { x: 20, y: 30 } },
    notes: [{ id: "note-1", text: "Keep me", x: 5, y: 6, width: 200 }]
  };

  const result = documentModel.reconcileState(state, previousSchema, nextSchema);

  assert.deepEqual(result.state.includedEntityIds, ["Author"]);
  assert.deepEqual(result.state.positions.Author, { x: 800, y: 400 });
  assert.deepEqual(result.state.positions.Book, { x: 20, y: 30 });
  assert.ok(result.state.positions.Review.y > 400 + documentModel.tableHeight(nextSchema.entities[0]));
  assert.deepEqual(result.state.notes, state.notes);
  assert.notEqual(result.state.notes, state.notes);
  assert.deepEqual(result.changes.entities, {
    added: ["Review"],
    removed: ["Book"],
    updated: ["Author"]
  });
  assert.deepEqual(result.changes.relationships, {
    added: ["author-reviews"],
    removed: ["author-books"],
    updated: []
  });
});

test("keeps a saved position when a removed entity reappears", () => {
  const previousSchema = { entities: [], relationships: [], specializations: [] };
  const nextSchema = { entities: [{ id: "Book", attributes: [] }], relationships: [], specializations: [] };
  const state = {
    includedEntityIds: [],
    positions: { Book: { x: 12, y: 34 } },
    notes: []
  };

  const result = documentModel.reconcileState(state, previousSchema, nextSchema);

  assert.deepEqual(result.state.positions.Book, { x: 12, y: 34 });
  assert.deepEqual(result.state.includedEntityIds, []);
});

test("summarizes schema changes", () => {
  const summary = documentModel.changeSummary({
    entities: { added: ["Book"], updated: ["Author"], removed: [] },
    relationships: { added: ["author-books"], updated: [], removed: [] },
    specializations: { added: [], updated: [], removed: [] }
  });

  assert.equal(summary, "Schema refreshed: 1 added, 1 updated, 1 relationship change.");
});

test("names removed tables in the schema summary", () => {
  const summary = documentModel.changeSummary({
    entities: { added: [], updated: [], removed: ["Book", "Review"] },
    relationships: { added: [], updated: [], removed: [] },
    specializations: { added: [], updated: [], removed: [] }
  });

  assert.equal(summary, "Schema refreshed: 2 removed (Book, Review).");
});

test("shows relationships only when both tables are included", () => {
  const schema = {
    entities,
    relationships: [
      { id: "author-books", source_id: "Author", destination_id: "Book" },
      { id: "book-reviews", source_id: "Book", destination_id: "Review" }
    ]
  };

  const visible = documentModel.visibleRelationships(schema, ["Author", "Book"]);

  assert.deepEqual(visible.map((relationship) => relationship.id), ["author-books"]);
});

test("formats bounded and unbounded cardinalities", () => {
  const relationship = {
    cardinality: {
      source: { minimum: 1, maximum: 1 },
      destination: { minimum: 0, maximum: null }
    }
  };

  assert.equal(documentModel.cardinalityLabel(relationship), "1 — 0..*");
});

test("fits diagram bounds into the viewport", () => {
  const transform = documentModel.fitViewport(
    { left: 100, top: 200, width: 800, height: 400 },
    { width: 1000, height: 700 },
    50
  );

  assert.deepEqual(transform, [1, 0, 0, 1, 0, -50]);
});

test("pans the viewport without changing its zoom", () => {
  const original = [0.75, 0, 0, 0.75, 120, -30];

  const transform = documentModel.panViewport(original, 25, -40);

  assert.deepEqual(transform, [0.75, 0, 0, 0.75, 95, 10]);
  assert.deepEqual(original, [0.75, 0, 0, 0.75, 120, -30]);
});

test("applies responsive pinch zoom within the canvas limits", () => {
  assert.ok(Math.abs(documentModel.zoomForWheel(1, 10) - 0.9048) < 0.0001);
  assert.ok(Math.abs(documentModel.zoomForWheel(1, -10) - 1.1052) < 0.0001);
  assert.equal(documentModel.zoomForWheel(0.15, 100), 0.15);
  assert.equal(documentModel.zoomForWheel(2.5, -100), 2.5);
});

test("avoids table caching at high effective Retina zoom", () => {
  assert.equal(documentModel.shouldCacheTable(1, 2), true);
  assert.equal(documentModel.shouldCacheTable(1.6, 2), false);
  assert.equal(documentModel.shouldCacheTable(2.5, 1), true);
});

test("batches pan deltas into one update per animation frame", () => {
  const frames = [];
  const updates = [];
  const schedulePan = documentModel.createPanScheduler(
    (deltaX, deltaY) => updates.push([deltaX, deltaY]),
    (callback) => { frames.push(callback); return frames.length; }
  );

  schedulePan(4, 7);
  schedulePan(-1, 5);

  assert.equal(frames.length, 1);
  assert.deepEqual(updates, []);
  frames.shift()();
  assert.deepEqual(updates, [[3, 12]]);

  schedulePan(2, 3);
  assert.equal(frames.length, 1);
});

test("reduces Retina quality only until panning becomes idle", () => {
  const timers = [];
  const cancelled = [];
  const retinaChanges = [];
  const controller = documentModel.createPanQualityController(
    (enabled) => retinaChanges.push(enabled),
    {
      idleDelay: 100,
      schedule: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
      cancel: (timer) => cancelled.push(timer)
    }
  );

  controller.begin();
  controller.begin();

  assert.deepEqual(retinaChanges, [false]);
  assert.equal(timers.length, 2);
  assert.deepEqual(cancelled, [1]);
  assert.equal(timers[1].delay, 100);

  timers[1].callback();
  assert.deepEqual(retinaChanges, [false, true]);
});
