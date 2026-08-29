# frozen_string_literal: true

require "stringio"
require "open3"
require "rbconfig"
require_relative "test_helper"

class CLITest < Minitest::Test
  def test_parse_uses_default_options
    options = CanvasERD::CLI.new.parse([])

    assert_equal :run, options.action
    assert_nil options.diagram_path
    assert options.open_browser
  end

  def test_parse_accepts_a_diagram_and_no_open
    options = CanvasERD::CLI.new.parse(["--no-open", "docs/domain.png"])

    assert_equal "docs/domain.png", options.diagram_path
    refute options.open_browser
  end

  def test_parse_rejects_multiple_diagrams
    error = assert_raises(OptionParser::ParseError) do
      CanvasERD::CLI.new.parse(["one.png", "two.png"])
    end

    assert_includes error.message, "expected at most one diagram path"
  end

  def test_help_is_successful
    out = StringIO.new
    status = CanvasERD::CLI.start(["--help"], out: out, err: StringIO.new)

    assert_equal 0, status
    assert_includes out.string, "Usage: canvas_erd"
  end

  def test_version_is_successful
    out = StringIO.new
    status = CanvasERD::CLI.start(["--version"], out: out, err: StringIO.new)

    assert_equal 0, status
    assert_equal "CanvasERD 0.1.0\n", out.string
  end

  def test_unknown_option_fails
    err = StringIO.new
    status = CanvasERD::CLI.start(["--unknown"], out: StringIO.new, err: err)

    assert_equal 1, status
    assert_includes err.string, "invalid option: --unknown"
  end

  def test_run_requires_a_rails_application
    err = StringIO.new
    status = CanvasERD::CLI.start([], out: StringIO.new, err: err)

    assert_equal 1, status
    assert_includes err.string, "Rails application environment not found"
  end

  def test_missing_diagram_fails_before_loading_rails
    err = StringIO.new
    status = CanvasERD::CLI.start(["diagram.png"], out: StringIO.new, err: err)

    assert_equal 1, status
    assert_includes err.string, "Could not read diagram"
  end

  def test_executable_loads_the_gem
    executable = File.expand_path("../exe/canvas_erd", __dir__)
    stdout, stderr, status = Open3.capture3(RbConfig.ruby, executable, "--version")

    assert status.success?, stderr
    assert_equal "CanvasERD 0.1.0\n", stdout
  end
end
