# frozen_string_literal: true

require "optparse"

module CanvasERD
  class CLI
    Options = Struct.new(:action, :diagram_path, :open_browser, keyword_init: true)

    def self.start(arguments = ARGV, out: $stdout, err: $stderr)
      new(out: out, err: err).start(arguments)
    end

    def initialize(out: $stdout, err: $stderr)
      @out = out
      @err = err
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
        @err.puts "CanvasERD's editor server has not been implemented yet."
        1
      end
    rescue OptionParser::ParseError => error
      @err.puts "Error: #{error.message}"
      @err.puts parser
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

