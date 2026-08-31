"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const png = require("../../lib/canvas_erd/web/png.js");

const onePixelPng = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));
const documentData = {
  format: "canvas_erd",
  version: 1,
  schema: { entities: [{ id: "Book" }], relationships: [], specializations: [] },
  state: {
    includedEntityIds: ["Book"],
    positions: {},
    notes: [],
    arrows: [{
      id: "arrow-1",
      start: { x: 10, y: 20, attachment: { type: "entity", id: "Book", x: 1, y: 0.5 } },
      end: { x: 100, y: 120, attachment: null }
    }]
  }
};

test("embeds and extracts an editable document without changing PNG identity", () => {
  const embedded = png.embedDocument(onePixelPng, documentData);

  assert.deepEqual([...embedded.slice(0, 8)], [...onePixelPng.slice(0, 8)]);
  assert.deepEqual(png.extractDocument(embedded), documentData);
});

test("rejects a PNG without an editable document", () => {
  assert.throws(
    () => png.extractDocument(onePixelPng),
    /does not contain an editable CanvasERD diagram/
  );
});

test("scales oversized diagram previews within browser canvas limits", () => {
  assert.equal(png.exportMultiplier(1000, 1000), 1);
  assert.equal(png.exportMultiplier(16384, 1024), 0.5);
  assert.equal(png.exportMultiplier(8192, 8192), 0.5);
});
