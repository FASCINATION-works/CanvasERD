# frozen_string_literal: true

require "fileutils"
require "stringio"

module CanvasERD
  class DiagramStore
    class Error < StandardError; end
    class NotFound < Error; end

    DEFAULT_DIRECTORY = "docs/erd"
    FILENAME_PATTERN = /\A[^\x00\/\\]+\.erd\.png\z/i

    attr_reader :directory

    def initialize(root:, directory: DEFAULT_DIRECTORY)
      @root = File.expand_path(root)
      @directory = File.expand_path(directory, @root)
      return if @directory.start_with?("#{@root}#{File::SEPARATOR}")

      raise Error, "Diagram directory must be inside the Rails application"
    end

    def relative_directory
      directory.delete_prefix("#{@root}#{File::SEPARATOR}")
    end

    def names
      return [] unless Dir.exist?(directory)

      Dir.children(directory).select { |name| valid_filename?(name) && File.file?(path_for(name)) }.sort
    end

    def most_recent_name
      names.max_by { |name| [File.mtime(path_for(name)).to_f, name] }
    rescue SystemCallError => error
      raise Error, "Could not inspect saved diagrams: #{error.message}"
    end

    def document(name)
      read_diagram(name).last
    end

    def read(name)
      read_diagram(name).first
    end

    def read_diagram(name)
      bytes = File.binread(path_for(name))
      [bytes, PngDocument.read(StringIO.new(bytes))]
    rescue Errno::ENOENT
      raise NotFound, "Diagram not found: #{name}"
    rescue SystemCallError => error
      raise Error, "Could not read diagram #{name}: #{error.message}"
    rescue PngDocument::Error => error
      raise Error, error.message
    end
    private :read_diagram

    def write(name, bytes)
      path = path_for(name)
      PngDocument.read(StringIO.new(bytes))
      FileUtils.mkdir_p(directory)
      File.binwrite(path, bytes)
      name
    rescue SystemCallError => error
      raise Error, "Could not save diagram #{name}: #{error.message}"
    rescue PngDocument::Error => error
      raise Error, error.message
    end

    private

    def path_for(name)
      raise Error, "Diagram filename must end in .erd.png" unless valid_filename?(name)

      File.join(directory, name)
    end

    def valid_filename?(name)
      name.is_a?(String) && FILENAME_PATTERN.match?(name)
    end
  end
end
