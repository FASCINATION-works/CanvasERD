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

test("keeps note selection padding aligned with its background while zooming", () => {
  assert.equal(documentModel.noteSelectionPadding(0.25), 3);
  assert.equal(documentModel.noteSelectionPadding(1), 12);
  assert.equal(documentModel.noteSelectionPadding(4), 48);
});

test("restores and saves note rotation", () => {
  assert.deepEqual(
    documentModel.noteCanvasGeometry({ x: 10, y: 20, width: 220, angle: 35 }),
    {
      left: 10,
      top: 20,
      width: 220,
      angle: 35,
      ...documentModel.DEFAULT_NOTE_FORMATTING
    }
  );
  assert.equal(documentModel.noteCanvasGeometry({ x: 10, y: 20, width: 220 }).angle, 0);
  assert.deepEqual(
    documentModel.noteStateGeometry({ left: 30, top: 40, width: 110, scaleX: 2, angle: -15, text: "Note" }),
    { x: 30, y: 40, width: 220, angle: -15, text: "Note", ...documentModel.DEFAULT_NOTE_FORMATTING }
  );
});

test("restores and saves whole-note formatting", () => {
  const formatting = {
    paragraphStyle: "heading",
    fontWeight: "bold",
    fontStyle: "italic",
    underline: true,
    fill: "#2563eb",
    backgroundColor: "#dbeafe",
    fontFamily: "Georgia",
    fontSize: 22,
    lineHeight: 1.15,
    textAlign: "center"
  };

  assert.deepEqual(documentModel.noteFormatting(formatting), formatting);
  assert.deepEqual(
    documentModel.noteCanvasGeometry({ x: 10, y: 20, width: 220, ...formatting }),
    { left: 10, top: 20, width: 220, angle: 0, ...formatting }
  );
  assert.deepEqual(
    documentModel.noteStateGeometry({
      left: 30,
      top: 40,
      width: 220,
      scaleX: 1,
      angle: 0,
      text: "Formatted",
      ...formatting
    }),
    { x: 30, y: 40, width: 220, angle: 0, text: "Formatted", ...formatting }
  );
});

test("uses default formatting for notes saved before formatting was available", () => {
  assert.deepEqual(documentModel.noteFormatting({}), documentModel.DEFAULT_NOTE_FORMATTING);
  assert.equal(documentModel.noteFormatting({ fontFamily: "Papyrus", fontSize: 300 }).fontSize, 15);
});

test("applies the four paragraph styles", () => {
  assert.deepEqual(documentModel.noteParagraphStyleFormatting("title"), {
    paragraphStyle: "title",
    fontFamily: "Georgia",
    fontSize: 32,
    fontWeight: "bold",
    lineHeight: 1.15
  });
  assert.deepEqual(documentModel.noteParagraphStyleFormatting("heading"), {
    paragraphStyle: "heading",
    fontFamily: "Georgia",
    fontSize: 22,
    fontWeight: "bold",
    lineHeight: 1.15
  });
  assert.equal(documentModel.noteParagraphStyleFormatting("paragraph").fontFamily, "Arial");
  assert.equal(documentModel.noteParagraphStyleFormatting("code").fontFamily, "Courier New");
  assert.equal(documentModel.noteParagraphStyleFormatting("unknown").paragraphStyle, "paragraph");
});

test("maps previously saved font choices to paragraph styles", () => {
  assert.equal(documentModel.noteParagraphStyle({ fontFamily: "Georgia", fontSize: 32 }), "title");
  assert.equal(documentModel.noteParagraphStyle({ fontFamily: "Times New Roman", fontSize: 24 }), "heading");
  assert.equal(documentModel.noteParagraphStyle({ fontFamily: "Courier New" }), "code");
  assert.equal(documentModel.noteParagraphStyle({ fontFamily: "Verdana", fontSize: 48 }), "paragraph");
});

test("inherits formatting from the last touched note", () => {
  const previous = {
    paragraphStyle: "code",
    fontWeight: "bold",
    fontStyle: "italic",
    underline: true,
    fill: "#155e75",
    backgroundColor: "transparent",
    textAlign: "center"
  };
  const inherited = documentModel.inheritedNoteFormatting(previous);

  assert.deepEqual(inherited, {
    ...previous,
    fontFamily: "Courier New",
    fontSize: 14,
    lineHeight: 1.2
  });
  assert.notEqual(inherited, previous);
  assert.deepEqual(documentModel.inheritedNoteFormatting(), documentModel.DEFAULT_NOTE_FORMATTING);
});

test("builds color swatches from defaults and colors used by notes", () => {
  const defaults = ["#ffffff", "#000000"];
  const notes = [
    { fill: "#123456", backgroundColor: "#ABCDEF" },
    { fill: "#ffffff", backgroundColor: "not-a-color" }
  ];

  assert.deepEqual(
    documentModel.noteColorSwatches(notes, "fill", defaults),
    ["#ffffff", "#000000", "#123456"]
  );
  assert.deepEqual(
    documentModel.noteColorSwatches(notes, "backgroundColor", defaults),
    ["#ffffff", "#000000", "#abcdef"]
  );
  assert.deepEqual(
    documentModel.noteColorSwatches(notes.slice(1), "fill", defaults),
    defaults
  );
});

test("uses position-matched background and foreground palettes", () => {
  assert.deepEqual(documentModel.DEFAULT_BACKGROUND_COLORS, [
    "#dbeafe", "#fee2e2", "#ffedd5", "#fff2a8",
    "#dcfce7", "#cffafe", "#ede9fe", "#f3f4f6"
  ]);
  assert.deepEqual(documentModel.DEFAULT_FOREGROUND_COLORS, [
    "#243b63", "#7f1d1d", "#9a3412", "#854d0e",
    "#166534", "#155e75", "#6b21a8", "#374151"
  ]);
  assert.deepEqual(documentModel.DEFAULT_TABLE_HEADER_COLORS, documentModel.DEFAULT_FOREGROUND_COLORS);
  assert.equal(documentModel.DEFAULT_ARROW_FORMATTING.color, documentModel.DEFAULT_FOREGROUND_COLORS[0]);
  assert.equal(documentModel.DEFAULT_BACKGROUND_COLORS.includes("transparent"), false);
});

test("normalizes arrow formatting and line styles", () => {
  assert.deepEqual(documentModel.arrowFormatting({}), documentModel.DEFAULT_ARROW_FORMATTING);
  assert.deepEqual(documentModel.arrowFormatting({
    color: "#123456",
    strokeWidth: "6.5",
    lineStyle: "dotted",
    startHead: "circle-open",
    endHead: "diamond-open"
  }), {
    color: "#123456",
    strokeWidth: 6.5,
    lineStyle: "dotted",
    startHead: "circle-open",
    endHead: "diamond-open"
  });
  assert.equal(documentModel.arrowFormatting({ startHead: "open" }).startHead, "open");
  assert.equal(documentModel.arrowFormatting({ endHead: "circle" }).endHead, "circle");
  assert.equal(documentModel.arrowFormatting({ endHead: "diamond" }).endHead, "diamond");
  assert.equal(documentModel.arrowFormatting({ strokeWidth: 100 }).strokeWidth, 20);
  assert.equal(documentModel.arrowFormatting({ strokeWidth: 0 }).strokeWidth, 0.5);
  assert.deepEqual(documentModel.arrowStrokeDashArray("dashed"), [10, 7]);
  assert.deepEqual(documentModel.arrowStrokeDashArray("dotted"), [2, 6]);
  assert.equal(documentModel.arrowStrokeDashArray("solid"), null);
});

test("stops arrow shafts at the rear edge of open circle and diamond heads", () => {
  assert.deepEqual(
    documentModel.shortenedArrowLinePoints(
      { x1: 0, y1: 0, x2: 100, y2: 0 },
      "circle-open",
      "diamond-open",
      2
    ),
    { x1: 10.08, y1: 0, x2: 87, y2: 0 }
  );
  assert.deepEqual(
    documentModel.shortenedArrowLinePoints(
      { x1: 0, y1: 0, x2: 100, y2: 0 },
      "open",
      "filled",
      2
    ),
    { x1: 0, y1: 0, x2: 100, y2: 0 }
  );
});

test("builds arrow color swatches from the foreground palette and used colors", () => {
  assert.deepEqual(documentModel.arrowColorSwatches([
    { color: "#ABCDEF" },
    { color: documentModel.DEFAULT_FOREGROUND_COLORS[0] },
    { color: "not-a-color" }
  ]), [
    ...documentModel.DEFAULT_FOREGROUND_COLORS,
    "#abcdef"
  ]);
});

test("normalizes frame formatting and drag bounds", () => {
  assert.deepEqual(documentModel.frameFormatting({}), documentModel.DEFAULT_FRAME_FORMATTING);
  assert.deepEqual(
    documentModel.frameFormatting({ color: "#abcdef", lineStyle: "dashed" }),
    { color: "#abcdef", lineStyle: "dashed" }
  );
  assert.equal(documentModel.frameFormatting({ lineStyle: "unknown" }).lineStyle, "solid");
  assert.deepEqual(
    documentModel.frameBounds({ x: 90, y: 80 }, { x: 10, y: 20 }),
    { x: 10, y: 20, width: 80, height: 60 }
  );
  assert.deepEqual(
    documentModel.frameLabelPosition({ x: 10, y: 20 }),
    { x: 20, y: 20 }
  );
  assert.deepEqual(
    documentModel.frameLabelCanvasStyle({ x: 10, y: 20, color: "#abcdef" }),
    {
      left: 20,
      top: 20,
      originY: "center",
      fill: "#abcdef",
      backgroundColor: "#f7f8fb"
    }
  );
});

test("builds frame color swatches from the foreground palette and used colors", () => {
  assert.deepEqual(documentModel.frameColorSwatches([
    { color: "#ABCDEF" },
    { color: documentModel.DEFAULT_FOREGROUND_COLORS[0] }
  ]), [
    ...documentModel.DEFAULT_FOREGROUND_COLORS,
    "#abcdef"
  ]);
});

test("separates default colors from colors used by the document", () => {
  const colors = ["#111111", "#222222", "#abcdef", "#123456"];

  assert.deepEqual(documentModel.colorPaletteSections(colors, colors.slice(0, 2)), {
    defaults: ["#111111", "#222222"],
    custom: ["#abcdef", "#123456"]
  });
});

test("derives a contrasting note border from its background", () => {
  assert.equal(documentModel.noteBorderColor("#fff2a8"), "#b3a976");
  assert.equal(documentModel.noteBorderColor("#123456"), "#597189");
  assert.equal(documentModel.noteBorderColor("transparent"), "#94a3b8");
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

test("recognizes whole-note formatting shortcuts", () => {
  assert.equal(documentModel.noteFormattingShortcut({ key: "b", metaKey: true }), "bold");
  assert.equal(documentModel.noteFormattingShortcut({ key: "I", ctrlKey: true }), "italic");
  assert.equal(documentModel.noteFormattingShortcut({ key: "u", metaKey: true }), "underline");
  assert.equal(documentModel.noteFormattingShortcut({ code: "Digit1", metaKey: true, altKey: true }), "title");
  assert.equal(documentModel.noteFormattingShortcut({ code: "Digit2", ctrlKey: true, altKey: true }), "heading");
  assert.equal(documentModel.noteFormattingShortcut({ code: "Digit3", metaKey: true, altKey: true }), "paragraph");
  assert.equal(documentModel.noteFormattingShortcut({ code: "Digit4", ctrlKey: true, altKey: true }), "code");
  assert.equal(documentModel.noteFormattingShortcut({ code: "Digit1", metaKey: true }), null);
  assert.equal(documentModel.noteFormattingShortcut({ key: "b" }), null);
  assert.equal(documentModel.noteFormattingShortcut({ key: "b", ctrlKey: true, altKey: true }), null);
});

test("maps editor keyboard shortcuts to actions", () => {
  assert.equal(documentModel.shortcutAction({ key: "o", metaKey: true }), "open");
  assert.equal(documentModel.shortcutAction({ key: "n", ctrlKey: true }), "new");
  assert.equal(documentModel.shortcutAction({ key: "n" }), "addNote");
  assert.equal(documentModel.shortcutAction({ key: "c" }), "addCode");
  assert.equal(documentModel.shortcutAction({ key: "c", metaKey: true }), null);
  assert.equal(documentModel.shortcutAction({ key: "a" }), "arrow");
  assert.equal(documentModel.shortcutAction({ key: "t" }), "toggleTables");
  assert.equal(documentModel.shortcutAction({ key: "l" }), "layoutTables");
  assert.equal(documentModel.shortcutAction({ key: "+" }), "zoomIn");
  assert.equal(documentModel.shortcutAction({ key: "=" }), "zoomIn");
  assert.equal(documentModel.shortcutAction({ key: "-" }), "zoomOut");
  assert.equal(documentModel.shortcutAction({ key: "0" }), "fit");
  assert.equal(documentModel.shortcutAction({ key: "?", shiftKey: true }), "help");
  assert.equal(documentModel.shortcutAction({ key: "n", altKey: true }), null);
});

test("centers a keyboard-created note at the canvas pointer", () => {
  assert.deepEqual(documentModel.notePositionAt({ x: 500, y: 400 }), { x: 390, y: 355 });
});

test("snaps an arrow endpoint to a target edge and resolves its anchor", () => {
  const bounds = { left: 100, top: 200, width: 300, height: 100 };
  const snapped = documentModel.snapPointToBounds({ x: 390, y: 240 }, bounds);

  assert.deepEqual(snapped.point, { x: 400, y: 240 });
  assert.deepEqual(snapped.anchor, { x: 1, y: 0.4 });
  assert.deepEqual(documentModel.pointAtAnchor(bounds, snapped.anchor), snapped.point);
});

test("attaches arrow endpoints to tables and notes", () => {
  assert.deepEqual(
    documentModel.arrowAttachment({ canvasErdType: "entity", entityId: "Book" }),
    { type: "entity", id: "Book" }
  );
  assert.deepEqual(
    documentModel.arrowAttachment({ canvasErdType: "note", noteId: "note-1" }),
    { type: "note", id: "note-1" }
  );
  assert.equal(documentModel.arrowAttachment({ canvasErdType: "arrow" }), null);
});

test("attaches arrow endpoints to code blocks", () => {
  assert.deepEqual(
    documentModel.arrowAttachment({ canvasErdType: "code", codeBlockId: "code-1" }),
    { type: "code", id: "code-1" }
  );
  assert.equal(documentModel.canvasLayer("code"), documentModel.canvasLayer("note"));
});

test("maps highlighted runs, including multi-line tokens, to per-character styles", () => {
  const keyword = { fill: "#cf222e", fontWeight: "bold" };
  const comment = { fill: "#6e7781" };
  const styles = documentModel.codeTokenStyles([
    ["def", keyword],
    [" x\n", {}],
    ["=begin\nhi\n=end", comment]
  ]);

  assert.deepEqual(styles[0][2], keyword);
  assert.notEqual(styles[0][2], keyword);
  assert.deepEqual(styles[0][4], {});
  assert.deepEqual(styles[1][0], comment);
  assert.deepEqual(Object.keys(styles[2]), ["0", "1"]);
  assert.deepEqual(styles[3][3], comment);
});

test("restores and saves code block geometry and text", () => {
  const block = { x: 10, y: 20, width: 300, angle: 5, code: "x" };

  assert.deepEqual(documentModel.codeCanvasGeometry(block), {
    left: 10,
    top: 20,
    width: 300,
    angle: 5,
    fontFamily: "Courier New",
    fontSize: 14,
    lineHeight: 1.2
  });
  assert.equal(documentModel.codeCanvasGeometry({ ...block, size: "large" }).fontSize, 18);
  assert.equal(documentModel.codeFontSize({ size: "small" }), 12);
  assert.equal(documentModel.codeFontSize({ size: "huge" }), 14);
  assert.deepEqual(
    documentModel.codeStateGeometry({ left: 1, top: 2, width: 100, scaleX: 2, angle: 0, text: "y" }),
    { x: 1, y: 2, width: 200, angle: 0, code: "y" }
  );
});

test("builds and labels source file references", () => {
  assert.deepEqual(
    documentModel.sourceFromFields(" app/models/book.rb ", "10", "25"),
    { path: "app/models/book.rb", startLine: 10, endLine: 25 }
  );
  assert.deepEqual(
    documentModel.sourceFromFields("app/models/book.rb", "", "0"),
    { path: "app/models/book.rb", startLine: null, endLine: null }
  );
  assert.equal(documentModel.sourceFromFields("  ", "1", "2"), null);
  assert.equal(documentModel.sourceReferenceLabel({ path: "a.rb", startLine: 10, endLine: null }), "a.rb:10-end");
  assert.equal(documentModel.sourceReferenceLabel({ path: "a.rb", startLine: null, endLine: 5 }), "a.rb:1-5");
  assert.equal(
    documentModel.sourceReferenceLabel({ path: "a.rb", startLine: 10, endLine: 25 }),
    "a.rb:10-25"
  );
  assert.equal(documentModel.sourceReferenceLabel({ path: "a.rb", startLine: 7, endLine: 7 }), "a.rb:7");
  assert.equal(documentModel.sourceReferenceLabel({ path: "a.rb", startLine: null, endLine: null }), "a.rb");
});

test("numbers code lines from their source and sizes the gutter", () => {
  assert.deepEqual(documentModel.codeLineLabels({ source: null }, 3), [1, 2, 3]);
  assert.deepEqual(documentModel.codeLineLabels({ source: { path: "a.rb", startLine: 98 } }, 3), [98, 99, 100]);
  assert.deepEqual(
    documentModel.codeLineLabels({ source: { model: "Book" }, lineNumbers: [null, 3, 4] }, 4),
    [null, 3, 4, null]
  );
  assert.deepEqual(documentModel.codeLineLabels({ source: { model: "Book" } }, 2), [null, null]);
  assert.equal(documentModel.codeGutterWidth([98, 99, 100], 10), 30);
  assert.equal(documentModel.codeGutterWidth([null], 10), 18);
});

test("finds the clicked code row and toggles highlighted lines", () => {
  assert.equal(documentModel.codeRowAt([10, 20, 10], 0), 0);
  assert.equal(documentModel.codeRowAt([10, 20, 10], 29.9), 1);
  assert.equal(documentModel.codeRowAt([10, 20, 10], 40), -1);
  assert.equal(documentModel.codeRowAt([10, 20, 10], -1), -1);
  assert.deepEqual(documentModel.toggleHighlightedLine(undefined, 34), [34]);
  assert.deepEqual(documentModel.toggleHighlightedLine([34, 40], 36), [34, 36, 40]);
  assert.deepEqual(documentModel.toggleHighlightedLine([34, 36, 40], 36), [34, 40]);
});

test("applies the anchor line's highlight state to every labelled line in the range", () => {
  const labels = [null, 3, 4, null, 9, 10];
  assert.deepEqual(documentModel.highlightLineRange([1, 10], labels, 10, 4), [1, 4, 9, 10]);
  assert.deepEqual(documentModel.highlightLineRange([3, 4, 9], labels, 10, 4), [3]);
  assert.deepEqual(documentModel.highlightLineRange([], labels, 99, 9), [9]);
});

test("finds, places, and labels model detail code blocks", () => {
  const scopes = { id: "code-1", source: { model: "Book", detail: "scopes" } };
  const codeBlocks = [{ id: "code-0", source: null }, { id: "code-2", source: { path: "a.rb" } }, scopes];

  assert.equal(documentModel.modelDetailBlock(codeBlocks, "Book", "scopes"), scopes);
  assert.equal(documentModel.modelDetailBlock(codeBlocks, "Author", "scopes"), null);
  assert.deepEqual(
    documentModel.modelDetailOrigin({ x: 10, y: 20 }),
    { x: 10 + documentModel.CARD_WIDTH + 80, y: 20 }
  );
  assert.equal(documentModel.sourceReferenceLabel(scopes.source), "Book scopes");
});

test("opens endpoint editing when an arrow is selected", () => {
  assert.equal(
    documentModel.arrowIdForEndpointEditing({ canvasErdType: "arrow", arrowId: "arrow-1" }),
    "arrow-1"
  );
  assert.equal(documentModel.arrowIdForEndpointEditing({ canvasErdType: "arrow-endpoint" }), null);
  assert.equal(documentModel.arrowIdForEndpointEditing({ canvasErdType: "entity" }), null);
});

test("layers frames behind relationships and arrows above notes", () => {
  assert.ok(documentModel.canvasLayer("frame") < documentModel.canvasLayer("frame-label"));
  assert.ok(documentModel.canvasLayer("frame-label") < documentModel.canvasLayer("relationship"));
  assert.ok(documentModel.canvasLayer("relationship") < documentModel.canvasLayer("entity"));
  assert.equal(documentModel.canvasLayer("entity"), documentModel.canvasLayer("note"));
  assert.ok(documentModel.canvasLayer("arrow") > documentModel.canvasLayer("note"));
  assert.ok(documentModel.canvasLayer("arrow-endpoint") > documentModel.canvasLayer("arrow"));
});

test("stores transformed arrow endpoints without replacing the selected object", () => {
  assert.deepEqual(
    documentModel.transformedArrowEndpoints(
      { x1: -10, y1: -20, x2: 10, y2: 20 },
      [2, 0, 0, 2, 100, 200]
    ),
    { start: { x: 80, y: 160 }, end: { x: 120, y: 240 } }
  );
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
  assert.deepEqual(original.frames, []);
  assert.deepEqual(original.codeBlocks, []);
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

test("stores header colors for selected tables", () => {
  const state = {
    includedEntityIds: ["Book", "Author"],
    positions: {},
    tableHeaderColors: { Book: "#123456" },
    notes: []
  };

  assert.equal(documentModel.tableHeaderColor(state, "Book"), "#123456");
  assert.equal(
    documentModel.tableHeaderColor(state, "Author"),
    documentModel.DEFAULT_TABLE_HEADER_COLOR
  );
  assert.equal(documentModel.selectedTableHeaderColor(state, ["Book", "Author"]), null);

  const grouped = documentModel.setTableHeaderColor(state, ["Book", "Author"], "#abcdef");
  assert.deepEqual(grouped.tableHeaderColors, { Book: "#abcdef", Author: "#abcdef" });
  assert.equal(documentModel.selectedTableHeaderColor(grouped, ["Book", "Author"]), "#abcdef");
  assert.ok(documentModel.tableHeaderColorSwatches(grouped.tableHeaderColors).includes("#abcdef"));

  const reset = documentModel.setTableHeaderColor(
    grouped,
    ["Book", "Author"],
    documentModel.DEFAULT_TABLE_HEADER_COLOR
  );
  assert.deepEqual(reset.tableHeaderColors, {});
  assert.equal(documentModel.tableHeaderColorSwatches(reset.tableHeaderColors).includes("#abcdef"), false);
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
    tableHeaderColors: { Author: "#166534" },
    frames: [{
      id: "frame-1",
      label: "Publishing",
      x: 1,
      y: 2,
      width: 600,
      height: 400,
      color: "#6b21a8",
      lineStyle: "dotted"
    }],
    notes: [{ id: "note-1", text: "Keep me", x: 5, y: 6, width: 200 }],
    codeBlocks: [{
      id: "code-1",
      code: "class Book",
      language: "ruby",
      x: 7,
      y: 8,
      width: 300,
      source: { path: "app/models/book.rb", startLine: 1, endLine: 1 }
    }],
    arrows: [{
      id: "arrow-1",
      start: { x: 1, y: 2, attachment: { type: "entity", id: "Author", x: 1, y: 0.5 } },
      end: { x: 3, y: 4, attachment: null },
      color: "#155e75",
      strokeWidth: 4,
      lineStyle: "dashed",
      startHead: "circle",
      endHead: "diamond"
    }]
  };

  const result = documentModel.reconcileState(state, previousSchema, nextSchema);

  assert.deepEqual(result.state.includedEntityIds, ["Author"]);
  assert.deepEqual(result.state.positions.Author, { x: 800, y: 400 });
  assert.deepEqual(result.state.positions.Book, { x: 20, y: 30 });
  assert.deepEqual(result.state.tableHeaderColors, state.tableHeaderColors);
  assert.notEqual(result.state.tableHeaderColors, state.tableHeaderColors);
  assert.deepEqual(result.state.frames, state.frames);
  assert.notEqual(result.state.frames, state.frames);
  assert.notEqual(result.state.frames[0], state.frames[0]);
  assert.ok(result.state.positions.Review.y > 400 + documentModel.tableHeight(nextSchema.entities[0]));
  assert.deepEqual(result.state.notes, state.notes);
  assert.notEqual(result.state.notes, state.notes);
  assert.deepEqual(result.state.codeBlocks, state.codeBlocks);
  assert.notEqual(result.state.codeBlocks[0].source, state.codeBlocks[0].source);
  assert.deepEqual(result.state.arrows, state.arrows);
  assert.notEqual(result.state.arrows, state.arrows);
  assert.notEqual(result.state.arrows[0].start, state.arrows[0].start);
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

test("maps standard ranges to crow's-foot cardinalities", () => {
  assert.deepEqual(
    documentModel.crowFootCardinality({ minimum: 0, maximum: 1 }),
    { optional: true, many: false }
  );
  assert.deepEqual(
    documentModel.crowFootCardinality({ minimum: 1, maximum: null }),
    { optional: false, many: true }
  );
  assert.equal(documentModel.crowFootCardinality({ minimum: 2, maximum: 5 }), null);
});

test("builds crow's feet at horizontal and diagonal table edges", () => {
  const horizontal = documentModel.relationshipEndpointGeometry(
    { left: 0, top: 0, width: 100, height: 60 },
    { x: 200, y: 30 },
    { minimum: 0, maximum: null }
  );
  assert.deepEqual(horizontal.boundary, { x: 100, y: 30 });
  assert.deepEqual(horizontal.shaftPoint, { x: 135, y: 30 });
  assert.deepEqual(horizontal.circles, [{ center: { x: 128, y: 30 }, radius: 4 }]);
  assert.deepEqual(horizontal.segments.slice(1, 4).map((segment) => segment.end), [
    { x: 109, y: 23 },
    { x: 109, y: 30 },
    { x: 109, y: 37 }
  ]);

  const diagonal = documentModel.relationshipEndpointGeometry(
    { left: 0, top: 0, width: 100, height: 100 },
    { x: 150, y: 150 },
    { minimum: 1, maximum: null }
  );
  const feet = diagonal.segments.slice(1, 4);
  const midpoint = {
    x: (feet[0].end.x + feet[2].end.x) / 2,
    y: (feet[0].end.y + feet[2].end.y) / 2
  };
  assert.ok(Math.abs(diagonal.boundary.x - 100) < 1e-9);
  assert.ok(Math.abs(diagonal.boundary.y - 100) < 1e-9);
  assert.ok(Math.abs(midpoint.x - feet[1].end.x) < 1e-9);
  assert.ok(Math.abs(midpoint.y - feet[1].end.y) < 1e-9);
  assert.ok(Math.abs(Math.hypot(
    feet[0].end.x - feet[2].end.x,
    feet[0].end.y - feet[2].end.y
  ) - 14) < 1e-9);

  const shallow = documentModel.relationshipEndpointGeometry(
    { left: 0, top: 0, width: 300, height: 100 },
    { x: 450, y: 110 },
    { minimum: 1, maximum: null }
  );
  assert.ok(Math.abs(shallow.boundary.x - 300) < 1e-9);
  assert.ok(Math.abs(shallow.boundary.y - 80) < 1e-9);
  shallow.segments.slice(1, 4).forEach((segment) => {
    assert.ok(segment.end.x > 300);
  });
});

test("keeps exact text for cardinalities crow's-foot notation cannot represent", () => {
  const endpoint = documentModel.relationshipEndpointGeometry(
    { left: 0, top: 0, width: 100, height: 60 },
    { x: 200, y: 30 },
    { minimum: 2, maximum: 5 }
  );

  assert.equal(endpoint.label, "2..5");
  assert.deepEqual(endpoint.segments, []);
  assert.deepEqual(endpoint.circles, []);
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
