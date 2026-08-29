# frozen_string_literal: true

require "json"
require "socket"

module CanvasERD
  class WebApplication
    WEB_ROOT = File.expand_path("web", __dir__)
    STATIC_FILES = {
      "/" => ["index.html", "text/html; charset=utf-8"],
      "/assets/app.js" => ["app.js", "application/javascript; charset=utf-8"],
      "/assets/styles.css" => ["styles.css", "text/css; charset=utf-8"],
      "/assets/fabric.min.js" => ["vendor/fabric.min.js", "application/javascript; charset=utf-8"]
    }.freeze

    attr_reader :schema

    def initialize(schema:)
      @schema = schema
    end

    def call(environment)
      method = environment.fetch("REQUEST_METHOD")
      path = environment.fetch("PATH_INFO")

      status, headers, body = if !%w[GET HEAD].include?(method)
        response(405, "text/plain; charset=utf-8", "Method Not Allowed", "allow" => "GET, HEAD")
      elsif path == "/api/schema"
        schema_response
      elsif STATIC_FILES.key?(path)
        file_response(*STATIC_FILES.fetch(path))
      else
        response(404, "text/plain; charset=utf-8", "Not Found")
      end

      body = [] if method == "HEAD"
      [status, security_headers.merge(headers), body]
    end

    private

    def schema_response
      response(
        200,
        "application/json; charset=utf-8",
        JSON.generate(schema),
        "cache-control" => "no-store"
      )
    end

    def file_response(relative_path, content_type)
      response(200, content_type, File.binread(File.join(WEB_ROOT, relative_path)))
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

    def self.rack_server_class
      require "rackup"
      Rackup::Server
    rescue LoadError
      begin
        require "rack/server"
        Rack::Server
      rescue LoadError => error
        raise Error, "Rackup is not available in this Rails application: #{error.message}"
      end
    end

    private

    def available_port
      socket = TCPServer.new(HOST, 0)
      socket.addr.fetch(1)
    ensure
      socket&.close
    end
  end
end
