"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const documentModel = require("../../lib/canvas_erd/web/document.js");

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
