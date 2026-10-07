# frozen_string_literal: true

require "prism"

module CanvasERD
  class ModelDetails
    class NotFound < StandardError; end

    DETAILS = %w[scopes].freeze

    module ScopeRecorder
      def scope(name, body, &block)
        location = caller_locations(1, 1).first
        ModelDetails.record_scope(self, name, location.absolute_path || location.path, location.lineno)
        super
      end
    end

    @scopes = Hash.new { |scopes, model| scopes[model] = [] }

    class << self
      attr_reader :scopes

      def install
        require "active_support/lazy_load_hooks"
        ActiveSupport.on_load(:active_record) { singleton_class.prepend(ScopeRecorder) }
      end

      def record_scope(model, name, path, line)
        return unless model.name

        scopes[model.name] << { name: name.to_s, path: path, line: line }
      end
    end

    def initialize(root:, scopes: self.class.scopes, source_path: ->(model) { Object.const_source_location(model)&.first })
      @root = File.realpath(root)
      @scopes = scopes
      @source_path = source_path
    end

    def summary
      @scopes.keys.each_with_object({}) do |model, summary|
        count = application_scopes(model).length
        summary[model] = { "scopes" => count } if count.positive?
      end
    end

    def detail(model, detail)
      raise NotFound, "Unknown model detail: #{detail}" unless DETAILS.include?(detail)
      raise NotFound, "No #{detail} for #{model}" if application_scopes(model).empty?

      rows = scope_rows(model)
      { "code" => rows.map(&:first).join("\n"), "language" => "ruby", "lineNumbers" => rows.map(&:last) }
    end

    private

    def scope_rows(model)
      model_path = @source_path.call(model)
      groups = application_scopes(model).group_by { |scope| scope[:path] }.map do |path, scopes|
        header = path == model_path ? [] : [["# #{relative_path(path)}", nil]]
        header + scopes.flat_map { |scope| snippet(path, scope) }
      end
      groups.each_with_index.flat_map { |rows, index| index.zero? ? rows : [["", nil], *rows] }
    end

    def application_scopes(model)
      return [] unless @scopes.key?(model)

      @scopes[model].select { |scope| scope[:path].start_with?("#{@root}#{File::SEPARATOR}") }
    end

    def snippet(path, scope)
      lines = File.readlines(path)
      node = scope_call_covering(Prism.parse_file(path).value, scope[:line])
      range = node ? node.location.start_line..node.location.end_line : scope[:line]..scope[:line]
      dedent(lines[(range.begin - 1)..(range.end - 1)]).zip(range)
    rescue SystemCallError
      [["# scope :#{scope[:name]} (source unavailable)", nil]]
    end

    def scope_call_covering(node, line)
      if node.is_a?(Prism::CallNode) && node.name == :scope && node.receiver.nil? &&
          (node.location.start_line..node.location.end_line).cover?(line)
        return node
      end

      node.compact_child_nodes.each do |child|
        found = scope_call_covering(child, line)
        return found if found
      end
      nil
    end

    def dedent(lines)
      indentation = lines.reject { |line| line.strip.empty? }.map { |line| line[/\A */].length }.min || 0
      lines.map { |line| line.strip.empty? ? "" : line.chomp[indentation..] }
    end

    def relative_path(path)
      path.delete_prefix("#{@root}#{File::SEPARATOR}")
    end
  end
end
