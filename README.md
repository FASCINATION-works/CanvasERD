# CanvasERD

CanvasERD is a companion gem for editing diagrams generated from Rails ERD domain models in a local browser.

The editor and local server are not implemented yet. The gem currently provides CLI argument parsing, the Rails ERD domain adapter, and the vendored Fabric.js browser asset needed by later phases.

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
