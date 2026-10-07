# frozen_string_literal: true

require_relative "test_helper"

class HighlighterTest < Minitest::Test
  def setup
    @highlighter = CanvasERD::Highlighter.new
  end

  def test_highlights_code_into_runs_that_rebuild_the_code
    result = @highlighter.highlight("def title\n  # heredoc\nend", "ruby")

    assert_equal "ruby", result["language"]
    assert_equal result["code"], result["runs"].map(&:first).join
    keyword = result["runs"].find { |text, _style| text == "def" }
    assert_match(/\A#\h{6}\z/, keyword.last.fetch("fill"))
  end

  def test_normalizes_line_endings_and_tabs
    result = @highlighter.highlight("a\r\n\tb", "plaintext")

    assert_equal "a\n  b", result["code"]
  end

  def test_falls_back_to_plain_text_for_unknown_languages
    assert_equal "plaintext", @highlighter.highlight("x", "no-such-language")["language"]
    assert_equal "plaintext", @highlighter.highlight("x", nil)["language"]
  end

  def test_guesses_languages_from_filenames
    assert_equal "ruby", @highlighter.language_for("app/models/book.rb")
    assert_kind_of String, @highlighter.language_for("include/book.h")
  end

  def test_lists_languages_and_theme_colors
    assert_includes @highlighter.languages, { "tag" => "ruby", "title" => "Ruby" }
    assert_match(/\A#\h{6}\z/, @highlighter.colors.fetch("foreground"))
    assert_match(/\A#\h{6}\z/, @highlighter.colors.fetch("background"))
  end
end
