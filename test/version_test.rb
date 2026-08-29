# frozen_string_literal: true

require_relative "test_helper"

class VersionTest < Minitest::Test
  def test_has_an_initial_version
    assert_equal "0.1.0", CanvasERD::VERSION
  end
end

