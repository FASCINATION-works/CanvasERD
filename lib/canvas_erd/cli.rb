# frozen_string_literal: true

require "optparse"

module CanvasERD
  class CLI
    class Error < StandardError; end

    Options = Struct.new(:action, :diagram_path, :open_browser, keyword_init: true)

    def self.start(arguments = ARGV, out: $stdout, err: $stderr)
      new(out: out, err: err).start(arguments)
    end

    def initialize(out: $stdout, err: $stderr, root: Dir.pwd)
      @out = out
      @err = err
      @root = root
    end

    def start(arguments)
      options = parse(arguments)

      case options.action
      when :help
        @out.puts parser
        0
      when :version
        @out.puts "CanvasERD #{CanvasERD::VERSION}"
        0
      else
        run(options)
      end
    rescue OptionParser::ParseError => error
      @err.puts "Error: #{error.message}"
      @err.puts parser
      1
    rescue Error, ApplicationLoader::Error, PngDocument::Error, Server::Error => error
      @err.puts "Error: #{error.message}"
      1
    rescue StandardError => error
      @err.puts "Failed: #{error.class}: #{error.message}"
      1
    end

    def parse(arguments)
      action = :run
      open_browser = true
      remaining = parser(action_setter: ->(value) { action = value }, open_setter: ->(value) { open_browser = value }).parse(arguments.dup)

      raise OptionParser::ParseError, "expected at most one diagram path" if remaining.length > 1

      Options.new(action: action, diagram_path: remaining.first, open_browser: open_browser)
    end

    private

    def run(options)
      if options.diagram_path
        @err.puts "Loading CanvasERD diagram from #{options.diagram_path}..."
        document = PngDocument.load(File.expand_path(options.diagram_path, @root))
      end

      @err.puts "Loading Rails application from #{@root}..."
      ApplicationLoader.new(@root).load

      schema_provider = SchemaProvider.new
      if document
        schema = document.fetch("schema")
        state = document.fetch("state")
      else
        @err.puts "Generating Rails ERD schema..."
        schema = schema_provider.call
      end
      app = WebApplication.new(schema: schema, schema_provider: schema_provider, state: state)
      server = Server.new(app: app)

      @out.puts "CanvasERD is running at #{server.url}"
      unless !options.open_browser || Browser.open(server.url)
        @err.puts "Could not open a browser. Visit #{server.url} manually."
      end

      server.start
      0
    end

    def parser(action_setter: ->(_value) {}, open_setter: ->(_value) {})
      OptionParser.new do |options|
        options.banner = "Usage: canvas_erd [options] [diagram.png]"

        options.on("--no-open", "Do not open the editor in a browser") do
          open_setter.call(false)
        end

        options.on("-v", "--version", "Print the CanvasERD version") do
          action_setter.call(:version)
        end

        options.on("-h", "--help", "Show this help") do
          action_setter.call(:help)
        end
      end
    end
  end
end
