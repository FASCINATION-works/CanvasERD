# CanvasERD

CanvasERD is a companion gem for editing diagrams generated from Rails ERD domain models in a local browser.

The editor renders Rails models and relationships on an interactive Fabric.js canvas.
New diagrams use ELK's layered graph layout to arrange tables from their Rails relationships.

## Installation

Add CanvasERD to the development group in the Rails application's `Gemfile`:

```ruby
group :development do
  gem "canvas_erd", require: false
end
```

Then run `bundle install`. CanvasERD requires Ruby 3.1 or newer, Active Record 7.0 or newer, and a Rack server available in the Rails bundle.

## Usage

From a Rails application root, run:

```sh
bundle exec canvas_erd
```

CanvasERD loads and eager-loads the Rails application, generates the schema, starts on a loopback-only address, and opens the editor in the default browser. Pass `--no-open` to print the URL without opening it.

CanvasERD uses Rackup with a server handler already present in the Rails bundle, normally Puma. It does not install a separate web server.

Diagrams are saved by the editor as `*.erd.png` files under `docs/erd/` in the Rails application. Use a different directory inside the application with `--diagrams-dir`, for example:

```sh
bundle exec canvas_erd --diagrams-dir db/diagrams
```

The editor's saved-diagram menu loads these files directly. You can also open a diagram when starting CanvasERD with `bundle exec canvas_erd path/to/domain.erd.png`.

## Editor controls

- Drag tables to reposition them.
- Use the table sidebar to add or remove tables without losing their positions.
- Use **Layout tables** to rearrange the tables currently on the canvas with ELK without moving notes or hidden tables.
- Pinch over the canvas or use the toolbar buttons to zoom.
- Use a two-finger trackpad gesture to pan. Space-drag remains available as a keyboard fallback, and **Fit diagram** resets the view.
- Add editable notes with **Add note**. Select a note and press Delete to remove it.
- Use **Refresh schema** after a database migration to update columns and relationships. Existing table positions, selections, notes, and the current view are preserved; new tables start unselected.
- Edit the diagram name, then use **Save** (or <kbd>⌘S</kbd>/<kbd>Ctrl-S</kbd>) to write the complete diagram into the Rails application as a normal `*.erd.png` image with its editable schema, layout, notes, selection, and viewport embedded inside it. Select a saved diagram from the menu to reopen it, or use **New** to start an “Untitled ERD.”

CanvasERD refreshes the model classes already loaded by the server. Restart CanvasERD after adding or renaming model classes or changing model code.
Image optimization tools may remove the CanvasERD metadata required to edit a diagram again.

The editor binds only to `127.0.0.1` and does not expose the Rails application over the network.

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
bundle exec rake build
```

## License

CanvasERD is available under the MIT License. Dependencies remain subject to their included licenses.

[Fabric.js](https://fabricjs.com/) 7.4.0 is vendored under `lib/canvas_erd/web/vendor`. Its license is included in `licenses/FABRIC-JS-LICENSE.txt`.
[elkjs](https://github.com/kieler/elkjs) 0.12.0 is vendored there as a browser API and Web Worker. Its [source is available from the elkjs project](https://github.com/kieler/elkjs/tree/0.12.0), and its license is included in `licenses/ELKJS-LICENSE.md`.
Icons from [iconoir](https://iconoir.com/) directly embedded in the HTML, and it's lincense is included in `licenses/ICONOIR-LICENSE`.
