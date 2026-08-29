# CanvasERD

CanvasERD is a companion gem for editing diagrams generated from Rails ERD domain models in a local browser.

The editor renders Rails models and relationships on an interactive Fabric.js canvas.

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

To reopen an editable CanvasERD PNG, pass it to the command:

```sh
bundle exec canvas_erd path/to/domain.png
```

## Editor controls

- Drag tables to reposition them.
- Use the table sidebar to add or remove tables without losing their positions.
- Pinch over the canvas or use the toolbar buttons to zoom.
- Use a two-finger trackpad gesture to pan. Space-drag remains available as a keyboard fallback, and **Fit diagram** resets the view.
- Add editable notes with **Add note**. Select a note and press Delete to remove it.
- Use **Refresh schema** after a database migration to update columns and relationships. Existing table positions, selections, notes, and the current view are preserved; new tables start unselected.
- Use **Save PNG** to download the complete diagram as a normal PNG with its editable schema, layout, notes, selection, and viewport embedded inside it.

CanvasERD refreshes the model classes already loaded by the server. Restart CanvasERD after adding or renaming model classes or changing model code.
Keep the original downloaded PNG when you need to edit it again; image optimization tools may remove its CanvasERD metadata.

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
gem build canvas_erd.gemspec
```

Fabric.js 7.4.0 is vendored under `lib/canvas_erd/web/vendor`. Its license is included in `licenses/FABRIC-JS-LICENSE.txt`.

## License

CanvasERD is available under the MIT License. Fabric.js remains subject to its included MIT license.
