# frozen_string_literal: true

require "stringio"
require "zlib"
require_relative "test_helper"

class PngDocumentTest < Minitest::Test
  DOCUMENT = {
    "format" => "canvas_erd",
    "version" => 1,
    "schema" => {
      "entities" => [{ "id" => "Book" }],
      "relationships" => [],
      "specializations" => []
    },
    "state" => { "includedEntityIds" => ["Book"], "positions" => {}, "notes" => [] }
  }.freeze

  def test_reads_an_embedded_document
    png = CanvasERD::PngDocument::SIGNATURE +
      chunk("IHDR", "\0" * 13) +
      chunk("iTXt", CanvasERD::PngDocument::ITXT_PREFIX + JSON.generate(DOCUMENT)) +
      chunk("IEND", "")

    assert_equal DOCUMENT, CanvasERD::PngDocument.read(StringIO.new(png))
  end

  def test_rejects_a_png_without_canvas_erd_metadata
    png = CanvasERD::PngDocument::SIGNATURE + chunk("IEND", "")

    error = assert_raises(CanvasERD::PngDocument::Error) do
      CanvasERD::PngDocument.read(StringIO.new(png))
    end

    assert_includes error.message, "does not contain an editable CanvasERD diagram"
  end

  def test_rejects_a_corrupt_chunk
    png = CanvasERD::PngDocument::SIGNATURE + [0].pack("N") + "IEND" + "bad!"

    error = assert_raises(CanvasERD::PngDocument::Error) do
      CanvasERD::PngDocument.read(StringIO.new(png))
    end

    assert_includes error.message, "checksum is invalid"
  end

  def test_rejects_an_unsupported_document_version
    document = DOCUMENT.merge("version" => 2)
    png = CanvasERD::PngDocument::SIGNATURE +
      chunk("iTXt", CanvasERD::PngDocument::ITXT_PREFIX + JSON.generate(document)) +
      chunk("IEND", "")

    error = assert_raises(CanvasERD::PngDocument::Error) do
      CanvasERD::PngDocument.read(StringIO.new(png))
    end

    assert_includes error.message, "format is not supported"
  end

  private

  def chunk(type, data)
    data = data.b
    [data.bytesize].pack("N") + type + data + [Zlib.crc32(type + data)].pack("N")
  end
end
