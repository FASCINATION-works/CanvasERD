# CanvasERD

CanvasERD is a companion gem for editing diagrams generated from Rails ERD domain models in a local browser.

The editor renders Rails models and relationships on an interactive Fabric.js canvas.

## Local server

From a Rails application root, run:

```sh
bundle exec canvas_erd
```

CanvasERD loads and eager-loads the Rails application, generates the schema, starts on a loopback-only address, and opens the editor shell in the default browser. Pass `--no-open` to print the URL without opening it.

CanvasERD uses Rackup with a server handler already present in the Rails bundle, normally Puma. It does not install a separate web server. Loading existing PNG diagrams will be added with PNG support.

## Editor controls

- Drag tables to reposition them.
- Use the table sidebar to add or remove tables without losing their positions.
- Scroll over the canvas or use the toolbar buttons to zoom.
- Hold Space and drag to pan, or use **Fit diagram** to reset the view.
- Add editable notes with **Add note**. Select a note and press Delete to remove it.

## Domain adapter

After loading the Rails application, generate a JSON-safe schema hash with:

```ruby
schema = CanvasERD::Diagram.create
```

The schema contains entities, attributes, relationships, and specializations with stable identifiers. Relationship cardinality ranges use `nil` as an unbounded maximum.

## Development

Run the tests:

```sh
bundle exec rake test
```

Build the gem:

```sh
gem build canvas_erd.gemspec
```

Fabric.js 7.4.0 is vendored under `lib/canvas_erd/web/vendor`. Its license is included in `licenses/FABRIC-JS-LICENSE.txt`.
