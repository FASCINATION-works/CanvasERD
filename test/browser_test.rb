# frozen_string_literal: true

require_relative "test_helper"

class BrowserTest < Minitest::Test
  def test_opens_a_url_on_macos_without_a_shell
    invocation = nil
    spawn = lambda do |*command, **options|
      invocation = [command, options]
      nil
    end
    browser = CanvasERD::Browser.new(host_os: "darwin24", process_spawn: spawn)

    assert browser.open("http://127.0.0.1:1234/")
    assert_equal ["open", "http://127.0.0.1:1234/"], invocation.fetch(0)
    assert_equal File::NULL, invocation.fetch(1).fetch(:out)
    assert_equal File::NULL, invocation.fetch(1).fetch(:err)
  end

  def test_uses_xdg_open_on_linux
    command = nil
    spawn = ->(*arguments, **_options) { command = arguments }
    browser = CanvasERD::Browser.new(host_os: "linux", process_spawn: spawn)

    assert browser.open("http://127.0.0.1:1234/")
    assert_equal ["xdg-open", "http://127.0.0.1:1234/"], command
  end

  def test_returns_false_for_an_unsupported_platform
    browser = CanvasERD::Browser.new(host_os: "unknown", process_spawn: -> { flunk })

    refute browser.open("http://127.0.0.1:1234/")
  end

  def test_returns_false_when_the_platform_command_is_missing
    spawn = ->(*, **) { raise Errno::ENOENT }
    browser = CanvasERD::Browser.new(host_os: "linux", process_spawn: spawn)

    refute browser.open("http://127.0.0.1:1234/")
  end
end
