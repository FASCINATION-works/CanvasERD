# frozen_string_literal: true

require "rouge"

module CanvasERD
  class Highlighter
    def initialize(theme: Rouge::Themes::Github.new)
      @theme = theme
    end

    def languages
      Rouge::Lexer.all
        .map { |lexer| { "tag" => lexer.tag, "title" => lexer.title } }
        .sort_by { |language| language["title"].downcase }
    end

    def colors
      style = @theme.style_for(Rouge::Token::Tokens::Text) || {}
      { "foreground" => color(style[:fg]), "background" => color(style[:bg]) }
    end

    def language_for(filename)
      Rouge::Lexer.guess(filename: filename) { Rouge::Lexers::PlainText }.tag
    rescue Rouge::Guesser::Ambiguous
      Rouge::Lexers::PlainText.tag
    end

    def highlight(code, language)
      code = normalize(code)
      lexer = Rouge::Lexer.find(language.to_s) || Rouge::Lexers::PlainText
      background = colors["background"]
      runs = lexer.lex(code).map { |token, text| [text, run_style(token, background)] }
      { "code" => code, "language" => lexer.tag, "runs" => runs }
    end

    def normalize(code)
      code.to_s.gsub(/\r\n?/, "\n").gsub("\t", "  ")
    end

    private

    def run_style(token, background)
      style = @theme.style_for(token) || {}
      result = {}
      result["fill"] = color(style[:fg]) if style[:fg]
      result["fontWeight"] = "bold" if style[:bold]
      result["fontStyle"] = "italic" if style[:italic]
      token_background = color(style[:bg])
      result["textBackgroundColor"] = token_background if token_background && token_background != background
      result
    end

    def color(value)
      value.is_a?(Symbol) ? @theme.class.palette(value) : value
    end
  end
end
