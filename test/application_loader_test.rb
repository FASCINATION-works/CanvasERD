# frozen_string_literal: true

require "fileutils"
require "tmpdir"
require_relative "test_helper"

class ApplicationLoaderTest < Minitest::Test
  FIXTURE_CONSTANT = :CanvasERDApplicationLoaderFixture

  def teardown
    Object.send(:remove_const, FIXTURE_CONSTANT) if Object.const_defined?(FIXTURE_CONSTANT, false)
  end

  def test_loads_the_application_environment
    Dir.mktmpdir do |root|
      config = File.join(root, "config")
      FileUtils.mkdir_p(config)
      File.write(File.join(config, "environment.rb"), "CanvasERDApplicationLoaderFixture = :loaded\n")

      assert CanvasERD::ApplicationLoader.new(root).load
      assert_equal :loaded, Object.const_get(FIXTURE_CONSTANT)
    end
  end

  def test_reports_a_missing_environment
    Dir.mktmpdir do |root|
      error = assert_raises(CanvasERD::ApplicationLoader::Error) do
        CanvasERD::ApplicationLoader.new(root).load
      end

      assert_includes error.message, File.join(root, "config", "environment.rb")
    end
  end
end
