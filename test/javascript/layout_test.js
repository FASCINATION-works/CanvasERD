"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const layout = require("../../lib/canvas_erd/web/layout.js");

const schema = {
  entities: [
    { id: "Author", attributes: [{}, {}] },
    { id: "Book", attributes: [{}] }
  ],
  relationships: [
    { id: "author-books", source_id: "Author", destination_id: "Book" },
    { id: "missing-book", source_id: "Missing", destination_id: "Book" }
  ]
};
const dimensions = {
  width: () => 300,
  height: (entity) => entity.attributes.length * 20 + 60
};

test("builds an ELK layered graph from entities and relationships", () => {
  const graph = layout.graphFor(schema, dimensions);

  assert.equal(graph.layoutOptions["elk.algorithm"], "layered");
  assert.equal(graph.layoutOptions["elk.direction"], "DOWN");
  assert.deepEqual(graph.children, [
    { id: "Author", width: 300, height: 100 },
    { id: "Book", width: 300, height: 80 }
  ]);
  assert.deepEqual(graph.edges, [
    { id: "relationship-0", sources: ["Author"], targets: ["Book"] }
  ]);
});

test("builds a layout schema for only the tables on the canvas", () => {
  const included = layout.schemaForEntityIds(schema, ["Book"]);

  assert.deepEqual(included.entities.map((entity) => entity.id), ["Book"]);
  assert.deepEqual(included.relationships, []);
  assert.deepEqual(schema.entities.map((entity) => entity.id), ["Author", "Book"]);
});

test("gives parallel relationships unique ELK edge ids", () => {
  const parallel = {
    ...schema,
    relationships: [schema.relationships[0], { ...schema.relationships[0] }]
  };

  assert.deepEqual(
    layout.graphFor(parallel, dimensions).edges.map((edge) => edge.id),
    ["relationship-0", "relationship-1"]
  );
});

test("uses ELK node positions with a consistent canvas margin", async () => {
  let receivedGraph;
  const engine = {
    async layout(graph) {
      receivedGraph = graph;
      return {
        ...graph,
        children: [
          { ...graph.children[0], x: 120, y: 80 },
          { ...graph.children[1], x: 520, y: 300 }
        ]
      };
    }
  };

  const positions = await layout.layoutEntities(schema, engine, dimensions);

  assert.equal(receivedGraph.id, "root");
  assert.deepEqual(positions, {
    Author: { x: 48, y: 48 },
    Book: { x: 448, y: 268 }
  });
});

test("rejects an incomplete ELK result", () => {
  assert.throws(
    () => layout.positionsFrom({ children: [{ id: "Book", x: 20 }] }),
    /without a position/
  );
});
