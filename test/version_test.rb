# frozen_string_literal: true

require_relative "test_helper"

class VersionTest < Minitest::Test
  def test_has_the_release_version
    assert_equal "0.2.0", CanvasERD::VERSION
  end
end
