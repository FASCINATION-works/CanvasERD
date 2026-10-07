# frozen_string_literal: true

require "fileutils"
require "tmpdir"
require_relative "test_helper"

class SourceFilesTest < Minitest::Test
  def test_reads_a_file_or_line_range_inside_the_application
    Dir.mktmpdir do |root|
      FileUtils.mkdir_p(File.join(root, "app/models"))
      File.write(File.join(root, "app/models/book.rb"), "one\ntwo\nthree\n")
      source_files = CanvasERD::SourceFiles.new(root: root)

      assert_equal "one\ntwo\nthree", source_files.read("app/models/book.rb")
      assert_equal "two\nthree", source_files.read("app/models/book.rb", start_line: 2, end_line: 9)
      assert_raises(CanvasERD::SourceFiles::Error) { source_files.read("app/models/book.rb", start_line: 4) }
    end
  end

  def test_rejects_files_outside_the_application
    Dir.mktmpdir do |directory|
      root = File.join(directory, "app")
      FileUtils.mkdir_p(root)
      File.write(File.join(directory, "secret.txt"), "secret")
      File.symlink(File.join(directory, "secret.txt"), File.join(root, "link.txt"))
      source_files = CanvasERD::SourceFiles.new(root: root)

      assert_raises(CanvasERD::SourceFiles::Error) { source_files.read("../secret.txt") }
      assert_raises(CanvasERD::SourceFiles::Error) { source_files.read("link.txt") }
      assert_raises(CanvasERD::SourceFiles::Error) { source_files.read(".") }
    end
  end

  def test_lists_application_files_respecting_gitignore
    Dir.mktmpdir do |root|
      write_files(root, ".gitignore" => "docker-volumes/\n", "app/models/book.rb" => "", "docker-volumes/db" => "")
      system("git", "init", "--quiet", root, exception: true)

      assert_equal [".gitignore", "app/models/book.rb"], CanvasERD::SourceFiles.new(root: root).paths
    end
  end

  def test_lists_files_without_git_skipping_hidden_and_generated_directories
    Dir.mktmpdir do |root|
      write_files(root, ".env" => "", "app/models/book.rb" => "", "node_modules/x.js" => "", "tmp/cache" => "")

      assert_equal ["app/models/book.rb"], CanvasERD::SourceFiles.new(root: root).paths
    end
  end

  def test_reports_missing_and_binary_files
    Dir.mktmpdir do |root|
      File.binwrite(File.join(root, "image.png"), "\x89PNG\x00")
      source_files = CanvasERD::SourceFiles.new(root: root)

      assert_raises(CanvasERD::SourceFiles::NotFound) { source_files.read("missing.rb") }
      assert_raises(CanvasERD::SourceFiles::Error) { source_files.read("image.png") }
    end
  end

  private

  def write_files(root, files)
    files.each do |path, content|
      FileUtils.mkdir_p(File.dirname(File.join(root, path)))
      File.write(File.join(root, path), content)
    end
  end
end
