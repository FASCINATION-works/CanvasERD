# frozen_string_literal: true

require "json"
require "rack/utils"
require "socket"

module CanvasERD
  class WebApplication
    WEB_ROOT = File.expand_path("web", __dir__)
    STATIC_FILES = {
      "/" => ["index.html", "text/html; charset=utf-8"],
      "/assets/app.js" => ["app.js", "application/javascript; charset=utf-8"],
      "/assets/document.js" => ["document.js", "application/javascript; charset=utf-8"],
      "/assets/layout.js" => ["layout.js", "application/javascript; charset=utf-8"],
      "/assets/png.js" => ["png.js", "application/javascript; charset=utf-8"],
      "/assets/styles.css" => ["styles.css", "text/css; charset=utf-8"],
      "/assets/fabric.min.js" => ["vendor/fabric.min.js", "application/javascript; charset=utf-8"],
      "/assets/elk-api.js" => ["vendor/elk-api.js", "application/javascript; charset=utf-8"],
      "/assets/elk-worker.min.js" => ["vendor/elk-worker.min.js", "application/javascript; charset=utf-8"]
    }.freeze

    attr_reader :schema

    def initialize(schema:, schema_provider: nil, state: nil, diagram_store: nil, source_files: nil,
      model_details: nil, highlighter: Highlighter.new)
      @schema = schema
      @schema_provider = schema_provider || -> { schema }
      @diagram_store = diagram_store
      @source_files = source_files
      @model_details = model_details
      @highlighter = highlighter
      @schema_mutex = Mutex.new
      @document = {
        "format" => "canvas_erd",
        "version" => 1,
        "schema" => schema,
        "state" => state
      }
    end

    def call(environment)
      method = environment.fetch("REQUEST_METHOD")
      path = environment.fetch("PATH_INFO")

      status, headers, body = route(method, path, environment)

      body = [] if method == "HEAD"
      [status, security_headers.merge(headers), body]
    rescue DiagramStore::NotFound, SourceFiles::NotFound, ModelDetails::NotFound => error
      status, headers, body = response(404, "text/plain; charset=utf-8", error.message)
      [status, security_headers.merge(headers), method == "HEAD" ? [] : body]
    rescue DiagramStore::Error, SourceFiles::Error => error
      status, headers, body = response(400, "text/plain; charset=utf-8", error.message)
      [status, security_headers.merge(headers), method == "HEAD" ? [] : body]
    end

    private

    def route(method, path, environment)
      if path == "/api/diagram"
        return method_not_allowed("GET, HEAD, PUT") unless %w[GET HEAD PUT].include?(method)

        return diagram_response(environment, write: method == "PUT")
      end

      if path == "/api/highlight"
        return method_not_allowed("POST") unless method == "POST"

        return highlight_response(environment)
      end

      return method_not_allowed("GET, HEAD") unless %w[GET HEAD].include?(method)

      if path == "/api/schema"
        schema_response(environment, refresh: method == "GET")
      elsif path == "/api/document"
        document_response
      elsif path == "/api/diagrams"
        diagrams_response
      elsif path == "/api/highlighting"
        json_response(@highlighter.colors.merge("languages" => @highlighter.languages))
      elsif path == "/api/source_files"
        source_files_response
      elsif path == "/api/source"
        source_response(environment)
      elsif path == "/api/model_details"
        json_response(@model_details ? @model_details.summary : {})
      elsif path == "/api/model_detail"
        model_detail_response(environment)
      elsif STATIC_FILES.key?(path)
        file_response(*STATIC_FILES.fetch(path))
      else
        response(404, "text/plain; charset=utf-8", "Not Found")
      end
    end

    def method_not_allowed(allow)
      response(405, "text/plain; charset=utf-8", "Method Not Allowed", "allow" => allow)
    end

    def schema_response(environment, refresh:)
      if refresh && environment.fetch("QUERY_STRING", "").split("&").include?("refresh=1")
        @schema_mutex.synchronize { @schema = @schema_provider.call }
      end

      response(
        200,
        "application/json; charset=utf-8",
        JSON.generate(schema),
        "cache-control" => "no-store"
      )
    end

    def document_response
      document = if @document["state"]
        @document
      elsif @diagram_store && (name = @diagram_store.most_recent_name)
        @diagram_store.document(name).merge(
          "filename" => name,
          "application_schema" => schema
        )
      else
        @document.merge("schema" => schema)
      end
      response(
        200,
        "application/json; charset=utf-8",
        JSON.generate(document),
        "cache-control" => "no-store"
      )
    end

    def diagrams_response
      return response(404, "text/plain; charset=utf-8", "Diagram storage is not configured") unless @diagram_store

      response(
        200,
        "application/json; charset=utf-8",
        JSON.generate("directory" => @diagram_store.relative_directory, "diagrams" => @diagram_store.names),
        "cache-control" => "no-store"
      )
    end

    def diagram_response(environment, write:)
      return response(404, "text/plain; charset=utf-8", "Diagram storage is not configured") unless @diagram_store

      name = Rack::Utils.parse_query(environment.fetch("QUERY_STRING", ""))["name"]
      if write
        bytes = environment.fetch("rack.input").read.b
        @diagram_store.write(name, bytes)
        response(200, "application/json; charset=utf-8", JSON.generate("name" => name))
      else
        response(
          200,
          "image/png",
          @diagram_store.read(name),
          "cache-control" => "no-store"
        )
      end
    end

    def highlight_response(environment)
      request = JSON.parse(environment.fetch("rack.input").read)
      raise JSON::ParserError, "expected an object" unless request.is_a?(Hash)

      json_response(@highlighter.highlight(request["code"], request["language"]))
    rescue JSON::ParserError
      response(400, "text/plain; charset=utf-8", "Invalid highlight request")
    end

    def source_response(environment)
      return response(404, "text/plain; charset=utf-8", "Source files are not configured") unless @source_files

      query = Rack::Utils.parse_query(environment.fetch("QUERY_STRING", ""))
      path = query["path"]
      code = @source_files.read(path, start_line: line_number(query["start"]), end_line: line_number(query["end"]))
      json_response(
        "path" => path,
        "code" => @highlighter.normalize(code),
        "language" => @highlighter.language_for(path)
      )
    end

    def source_files_response
      return response(404, "text/plain; charset=utf-8", "Source files are not configured") unless @source_files

      json_response("paths" => @source_files.paths)
    end

    def model_detail_response(environment)
      return response(404, "text/plain; charset=utf-8", "Model details are not configured") unless @model_details

      query = Rack::Utils.parse_query(environment.fetch("QUERY_STRING", ""))
      json_response(@model_details.detail(query["model"], query["detail"]))
    end

    def line_number(value)
      return nil if value.nil? || value.empty?
      raise SourceFiles::Error, "Invalid line number: #{value}" unless value.match?(/\A\d+\z/)

      value.to_i
    end

    def json_response(data)
      response(200, "application/json; charset=utf-8", JSON.generate(data), "cache-control" => "no-store")
    end

    def file_response(relative_path, content_type)
      response(
        200,
        content_type,
        File.binread(File.join(WEB_ROOT, relative_path)),
        "cache-control" => "no-store"
      )
    end

    def response(status, content_type, body, headers = {})
      headers = { "content-type" => content_type }.merge(headers)
      [status, headers, [body]]
    end

    def security_headers
      {
        "content-security-policy" => "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; " \
          "object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        "x-content-type-options" => "nosniff",
        "referrer-policy" => "no-referrer"
      }
    end
  end

  class Server
    class Error < StandardError; end

    HOST = "127.0.0.1"

    attr_reader :port

    def initialize(app:, port: nil, rack_server_class: nil)
      @app = app
      @port = port || available_port
      @rack_server_class = rack_server_class || self.class.rack_server_class
    end

    def start
      @rack_server_class.start(
        app: @app,
        Host: HOST,
        Port: port,
        environment: "none"
      )
    rescue LoadError => error
      raise Error, "No Rack server handler is available: #{error.message}"
    end

    def url
      "http://#{HOST}:#{port}/"
    end

    def self.rack_server_class(loader: method(:load_rack_server_class))
      loader.call("rackup", "Rackup") ||
        loader.call("rack/server", "Rack") ||
        raise(Error, "No Rack server is available in this Rails application")
    end

    def self.load_rack_server_class(feature, namespace_name)
      require feature
      namespace = Object.const_get(namespace_name)
      namespace.const_get(:Server, false) if namespace.const_defined?(:Server, false)
    rescue LoadError, NameError
      nil
    end

    private_class_method :load_rack_server_class

    private

    def available_port
      socket = TCPServer.new(HOST, 0)
      socket.addr.fetch(1)
    ensure
      socket&.close
    end
  end
end
