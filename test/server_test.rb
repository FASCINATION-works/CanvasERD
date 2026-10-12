# frozen_string_literal: true

require "rack/mock"
require "tmpdir"
require "zlib"
require_relative "test_helper"

class ServerTest < Minitest::Test
  SCHEMA = {
    "name" => "Example",
    "entities" => [{ "id" => "Book" }],
    "relationships" => [],
    "specializations" => []
  }.freeze

  def setup
    @app = CanvasERD::WebApplication.new(schema: SCHEMA)
    @request = Rack::MockRequest.new(@app)
  end

  def test_serves_the_editor_shell
    response = @request.get("/")

    assert_equal 200, response.status
    assert_includes response["content-type"], "text/html"
    assert_includes response.body, '<h1 id="diagram-name-display">Untitled ERD</h1>'
    assert_includes response.body, 'id="diagram-name"'
    assert_includes response.body, 'id="edit-diagram-name"'
    assert_includes response.body, 'class="diagram-toolbar"'
    assert_includes response.body, 'id="open-diagram"'
    assert_includes response.body, 'id="new-diagram"'
    assert_includes response.body, 'id="save-diagram"'
    assert_match(/<button id="save-diagram"[^>]* disabled>/, response.body)
    assert_match(/<select id="saved-diagrams"[^>]* hidden>/, response.body)
    assert_includes response.body, 'aria-label="Refresh schema"'
    assert_includes response.body, 'id="tables-sidebar" class="sidebar collapsed"'
    assert_includes response.body, 'id="toggle-tables"'
    assert_includes response.body, 'id="layout-tables"'
    assert_includes response.body, 'class="canvas-tools"'
    assert_includes response.body, 'title="Add note (N)"'
    assert_includes response.body, 'id="add-arrow"'
    assert_includes response.body, 'title="Add code (C)"'
    assert_includes response.body, "Add code at cursor"
    assert_includes response.body, 'id="add-source"'
    assert_includes response.body, 'id="code-formatting"'
    assert_includes response.body, 'id="source-dialog"'
    assert_includes response.body, 'list="source-file-paths"'
    assert_includes response.body, "Arrow tool (A)"
    assert_includes response.body, "Free arrow endpoint"
    assert_includes response.body, 'title="Show tables (T)"'
    assert_includes response.body, 'title="Zoom in (+)"'
    assert_includes response.body, 'title="Fit diagram (0)"'
    assert_includes response.body, "Ctrl-O"
    assert_includes response.body, 'id="shortcut-help"'
    assert_includes response.body, 'id="shortcut-panel"'
    assert_includes response.body, "Add note at cursor"
    assert_includes response.body, '<dt>Layout tables</dt><dd><kbd>L</kbd>'
    assert_includes response.body, '<option value="" selected>Untitled ERD</option>'
    assert_includes response.body, 'href="https://github.com/FASCINATION-works/CanvasERD"'
    assert_includes response.body, '<svg '
    refute_includes response.body, "Drag tables to arrange"
    refute_includes response.body, 'id="load-diagram"'
  end

  def test_serves_the_schema_as_json_without_caching
    response = @request.get("/api/schema")

    assert_equal 200, response.status
    assert_equal SCHEMA, JSON.parse(response.body)
    assert_equal "no-store", response["cache-control"]
    assert_includes response["content-security-policy"], "default-src 'self'"
    assert_equal "nosniff", response["x-content-type-options"]
  end

  def test_serves_the_initial_editable_document
    state = { "includedEntityIds" => ["Book"], "positions" => {}, "notes" => [] }
    response = Rack::MockRequest.new(CanvasERD::WebApplication.new(schema: SCHEMA, state: state)).get("/api/document")

    assert_equal 200, response.status
    assert_equal({
      "format" => "canvas_erd",
      "version" => 1,
      "schema" => SCHEMA,
      "state" => state
    }, JSON.parse(response.body))
    assert_equal "no-store", response["cache-control"]
  end

  def test_serves_the_most_recent_saved_diagram_as_the_initial_document
    Dir.mktmpdir do |root|
      store = CanvasERD::DiagramStore.new(root: root)
      store.write("older.erd.png", editable_png)
      store.write("newer.erd.png", editable_png)
      File.utime(Time.at(100), Time.at(100), File.join(root, "docs/erd/older.erd.png"))
      File.utime(Time.at(200), Time.at(200), File.join(root, "docs/erd/newer.erd.png"))
      app = CanvasERD::WebApplication.new(schema: SCHEMA, diagram_store: store)

      document = JSON.parse(Rack::MockRequest.new(app).get("/api/document").body)

      assert_equal "newer.erd.png", document.fetch("filename")
      assert_equal SCHEMA, document.fetch("application_schema")
      assert_equal ["Book"], document.dig("state", "includedEntityIds")
    end
  end

  def test_refreshes_and_caches_the_schema_when_requested
    refreshed_schema = SCHEMA.merge("entities" => [{ "id" => "Author" }])
    provider_calls = 0
    app = CanvasERD::WebApplication.new(
      schema: SCHEMA,
      schema_provider: -> { provider_calls += 1; refreshed_schema }
    )
    request = Rack::MockRequest.new(app)

    assert_equal refreshed_schema, JSON.parse(request.get("/api/schema?refresh=1").body)
    assert_equal refreshed_schema, JSON.parse(request.get("/api/schema").body)
    assert_equal refreshed_schema, JSON.parse(request.get("/api/document").body).fetch("schema")
    assert_equal 1, provider_calls
  end

  def test_head_does_not_refresh_the_schema
    provider_calls = 0
    app = CanvasERD::WebApplication.new(schema: SCHEMA, schema_provider: -> { provider_calls += 1; SCHEMA })

    Rack::MockRequest.new(app).request("HEAD", "/api/schema?refresh=1")

    assert_equal 0, provider_calls
  end

  def test_serves_only_known_static_assets
    javascript = @request.get("/assets/app.js")
    document_model = @request.get("/assets/document.js")
    layout_model = @request.get("/assets/layout.js")
    png_model = @request.get("/assets/png.js")
    fabric = @request.get("/assets/fabric.min.js")
    elk_api = @request.get("/assets/elk-api.js")
    elk_worker = @request.get("/assets/elk-worker.min.js")
    missing = @request.get("/assets/../server.rb")

    assert_equal 200, javascript.status
    assert_includes javascript["content-type"], "application/javascript"
    assert_equal "no-store", javascript["cache-control"]
    assert_equal 200, document_model.status
    assert_includes document_model.body, "CanvasERDDocument"
    assert_equal 200, layout_model.status
    assert_includes layout_model.body, "CanvasERDLayout"
    assert_equal 200, png_model.status
    assert_includes png_model.body, "CanvasERDPng"
    assert_equal 200, fabric.status
    assert_includes fabric.body, "e.fabric={}"
    assert_equal 200, elk_api.status
    assert_includes elk_api.body, "g.ELK = f()"
    assert_equal 200, elk_worker.status
    assert_operator elk_worker.body.bytesize, :>, 1_000_000
    assert_equal 404, missing.status
    assert_match(/\.canvas-footer \{[^}]*right: 0\.75rem;/m, @request.get("/assets/styles.css").body)
  end

  def test_supports_head_requests
    response = @request.request("HEAD", "/api/schema")

    assert_equal 200, response.status
    assert_empty response.body
  end

  def test_saves_lists_and_loads_diagrams_from_the_application
    Dir.mktmpdir do |root|
      store = CanvasERD::DiagramStore.new(root: root)
      request = Rack::MockRequest.new(CanvasERD::WebApplication.new(schema: SCHEMA, diagram_store: store))
      png = editable_png

      saved = request.put("/api/diagram?name=domain.erd.png", input: png)
      listed = request.get("/api/diagrams")
      loaded = request.get("/api/diagram?name=domain.erd.png")

      assert_equal 200, saved.status
      assert_equal({ "name" => "domain.erd.png" }, JSON.parse(saved.body))
      assert_equal({ "directory" => "docs/erd", "diagrams" => ["domain.erd.png"] }, JSON.parse(listed.body))
      assert_equal 200, loaded.status
      assert_equal "image/png", loaded["content-type"]
      assert_equal png, loaded.body
    end
  end

  def test_rejects_an_invalid_diagram_filename
    Dir.mktmpdir do |root|
      store = CanvasERD::DiagramStore.new(root: root)
      request = Rack::MockRequest.new(CanvasERD::WebApplication.new(schema: SCHEMA, diagram_store: store))

      response = request.put("/api/diagram?name=domain.png", input: editable_png)

      assert_equal 400, response.status
      assert_includes response.body, ".erd.png"
      assert_includes response["content-security-policy"], "default-src 'self'"
    end
  end

  def test_serves_highlighting_languages_and_highlights_code
    languages = JSON.parse(@request.get("/api/highlighting").body)
    highlighted = @request.post("/api/highlight", input: JSON.generate("code" => "def x; end", "language" => "ruby"))
    invalid = @request.post("/api/highlight", input: "nope")

    assert_includes languages.fetch("languages"), { "tag" => "ruby", "title" => "Ruby" }
    assert_equal 200, highlighted.status
    assert_equal "def x; end", JSON.parse(highlighted.body)["runs"].map(&:first).join
    assert_equal 400, invalid.status
    assert_equal "POST", @request.get("/api/highlight")["allow"]
  end

  def test_serves_application_source_files
    Dir.mktmpdir do |root|
      File.write(File.join(root, "book.rb"), "class Book\nend\n")
      app = CanvasERD::WebApplication.new(schema: SCHEMA, source_files: CanvasERD::SourceFiles.new(root: root))
      request = Rack::MockRequest.new(app)

      source = request.get("/api/source?path=book.rb&start=1&end=1")

      assert_equal({ "path" => "book.rb", "code" => "class Book", "language" => "ruby" }, JSON.parse(source.body))
      assert_equal({ "paths" => ["book.rb"] }, JSON.parse(request.get("/api/source_files").body))
      assert_equal 404, request.get("/api/source?path=missing.rb").status
      assert_equal 400, request.get("/api/source?path=#{__FILE__}").status
      assert_equal 400, request.get("/api/source?path=book.rb&start=x").status
    end
  end

  def test_serves_model_details
    Dir.mktmpdir do |root|
      File.write(File.join(root, "book.rb"), "scope :recent, -> { order(:id) }\n")
      scopes = { "Book" => [{ name: "recent", path: File.join(File.realpath(root), "book.rb"), line: 1 }] }
      details = CanvasERD::ModelDetails.new(root: root, scopes: scopes, source_path: ->(_model) {})
      request = Rack::MockRequest.new(CanvasERD::WebApplication.new(schema: SCHEMA, model_details: details))

      assert_equal({ "Book" => { "scopes" => 1 } }, JSON.parse(request.get("/api/model_details").body))
      assert_equal(
        { "code" => "# book.rb\nscope :recent, -> { order(:id) }", "language" => "ruby", "lineNumbers" => [nil, 1] },
        JSON.parse(request.get("/api/model_detail?model=Book&detail=scopes").body)
      )
      assert_equal 404, request.get("/api/model_detail?model=Author&detail=scopes").status
      assert_equal({}, JSON.parse(@request.get("/api/model_details").body))
    end
  end

  def test_rejects_mutating_methods
    response = @request.post("/api/schema")

    assert_equal 405, response.status
    assert_equal "GET, HEAD", response["allow"]
  end

  def test_server_passes_the_rack_app_to_the_available_runner
    runner = Class.new do
      class << self
        attr_reader :options

        def start(options)
          @options = options
          :stopped
        end
      end
    end
    server = CanvasERD::Server.new(app: @app, port: 4567, rack_server_class: runner)

    assert_equal :stopped, server.start
    assert_equal @app, runner.options.fetch(:app)
    assert_equal "127.0.0.1", runner.options.fetch(:Host)
    assert_equal 4567, runner.options.fetch(:Port)
    assert_equal "none", runner.options.fetch(:environment)
    assert_equal "http://127.0.0.1:4567/", server.url
  end

  def test_server_uses_rack_server_when_rackup_has_no_server
    rack_server = Class.new
    loaded = []
    loader = lambda do |feature, namespace|
      loaded << [feature, namespace]
      rack_server if namespace == "Rack"
    end

    assert_equal rack_server, CanvasERD::Server.rack_server_class(loader: loader)
    assert_equal [["rackup", "Rackup"], ["rack/server", "Rack"]], loaded
  end

  private

  def editable_png
    document = {
      "format" => "canvas_erd",
      "version" => 1,
      "schema" => SCHEMA,
      "state" => { "includedEntityIds" => ["Book"], "positions" => {}, "notes" => [] }
    }
    CanvasERD::PngDocument::SIGNATURE +
      chunk("iTXt", CanvasERD::PngDocument::ITXT_PREFIX + JSON.generate(document)) +
      chunk("IEND", "")
  end

  def chunk(type, data)
    data = data.b
    [data.bytesize].pack("N") + type + data + [Zlib.crc32(type + data)].pack("N")
  end
end
