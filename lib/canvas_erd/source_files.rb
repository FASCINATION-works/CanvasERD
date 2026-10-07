# frozen_string_literal: true

require "find"
require "open3"

module CanvasERD
  class SourceFiles
    class Error < StandardError; end
    class NotFound < Error; end

    IGNORED_DIRECTORIES = %w[node_modules tmp log storage coverage vendor/bundle public/assets public/packs].freeze

    def initialize(root:)
      @root = File.realpath(root)
    end

    def paths
      output, status = Open3.capture2(
        "git", "ls-files", "-z", "--cached", "--others", "--exclude-standard",
        chdir: @root, err: File::NULL
      )
      return walked_paths unless status.success?

      output.split("\0").select { |path| File.file?(File.join(@root, path)) }.sort
    rescue SystemCallError
      walked_paths
    end

    def walked_paths
      paths = []
      Find.find(@root) do |path|
        relative_path = path.delete_prefix("#{@root}#{File::SEPARATOR}")
        next if path == @root
        next Find.prune if File.basename(path).start_with?(".") || IGNORED_DIRECTORIES.include?(relative_path)

        paths << relative_path if File.file?(path)
      end
      paths.sort
    end
    private :walked_paths

    def read(path, start_line: nil, end_line: nil)
      full_path = File.realpath(path.to_s, @root)
      unless full_path.start_with?("#{@root}#{File::SEPARATOR}")
        raise Error, "Source file must be inside the Rails application"
      end
      raise Error, "Source path is not a file: #{path}" unless File.file?(full_path)

      code = File.read(full_path, encoding: "UTF-8")
      raise Error, "Source file is not UTF-8 text: #{path}" if !code.valid_encoding? || code.include?("\0")

      lines(code, start_line, end_line)
    rescue Errno::ENOENT
      raise NotFound, "Source file not found: #{path}"
    rescue SystemCallError => error
      raise Error, "Could not read source file #{path}: #{error.message}"
    end

    private

    def lines(code, start_line, end_line)
      lines = code.lines
      first = start_line || 1
      last = [end_line || lines.length, lines.length].min
      raise Error, "Invalid line range #{start_line}-#{end_line}" if first < 1 || (lines.any? && first > last)

      Array(lines[(first - 1)..(last - 1)]).join.chomp
    end
  end
end
