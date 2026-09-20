# Changelog

## 0.2.0 - 2026-09-19

- Format whole notes with paragraph styles, bold, italic, underline, alignment, text and background colors, and keyboard shortcuts for styles and emphasis.
- Choose colors from common options or custom values currently used in the diagram, including transparent note backgrounds and background-aware borders.
- Color the headers of one or more selected tables to visually group related tables, with preset and custom colors.
- Enter arrow endpoint editing immediately when an arrow is selected, without requiring a double-click.
- Style arrows with independent endpoint heads, solid, dashed, or dotted lines, adjustable widths, and foreground-palette or custom colors.
- Draw backmost grouping frames with editable labels, foreground-palette or custom colors, and solid, dashed, or dotted borders.
- Render association cardinalities with table-edge-aligned crow's-foot notation, retaining text for nonstandard numeric ranges.
- Open the most recently modified saved diagram when the editor starts.

## 0.1.0 - 2026-08-30

- Generate a JSON-safe diagram schema from Rails ERD domain models.
- Start a loopback-only editor using the Rails application's Rack server.
- Arrange and select tables on a Fabric.js canvas, with editable notes, arrows, zoom, and pan controls.
- Refresh columns and relationships while preserving diagram edits.
- Save editable diagrams inside ordinary PNG files and reopen them from the CLI.
