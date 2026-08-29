# CanvasERD

CanvasERD is a companion gem for editing diagrams generated from Rails ERD domain models in a local browser.

The editor and local server are not implemented yet. The current scaffold provides the gem package, CLI argument parsing, and vendored Fabric.js browser asset needed by later phases.

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

