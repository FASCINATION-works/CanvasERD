# frozen_string_literal: true

require "tmpdir"
require "zlib"
require_relative "test_helper"

class DiagramStoreTest < Minitest::Test
  DOCUMENT = {
    "format" => "canvas_erd",
    "version" => 1,
    "schema" => { "entities" => [], "relationships" => [], "specializations" => [] },
    "state" => { "includedEntityIds" => [], "positions" => {}, "notes" => [] }
  }.freeze

  def test_writes_lists_and_reads_editable_diagrams
    Dir.mktmpdir do |root|
      store = CanvasERD::DiagramStore.new(root: root)
      png = editable_png

      assert_equal "domain.erd.png", store.write("domain.erd.png", png)
      assert_equal ["domain.erd.png"], store.names
      assert_equal png, store.read("domain.erd.png")
      assert_equal "docs/erd", store.relative_directory
    end
  end

  def test_rejects_unsafe_or_non_erd_filenames
    Dir.mktmpdir do |root|
      store = CanvasERD::DiagramStore.new(root: root)

      assert_raises(CanvasERD::DiagramStore::Error) { store.write("domain.png", editable_png) }
      assert_raises(CanvasERD::DiagramStore::Error) { store.write("../domain.erd.png", editable_png) }
    end
  end

  def test_finds_the_most_recently_modified_diagram
    Dir.mktmpdir do |root|
      store = CanvasERD::DiagramStore.new(root: root)
      store.write("older.erd.png", editable_png)
      store.write("newer.erd.png", editable_png)
      older = File.join(root, "docs/erd/older.erd.png")
      newer = File.join(root, "docs/erd/newer.erd.png")
      File.utime(Time.at(100), Time.at(100), older)
      File.utime(Time.at(200), Time.at(200), newer)

      assert_equal "newer.erd.png", store.most_recent_name
      assert_equal DOCUMENT, store.document("newer.erd.png")
    end
  end

  def test_has_no_most_recent_diagram_when_the_store_is_empty
    Dir.mktmpdir do |root|
      store = CanvasERD::DiagramStore.new(root: root)

      assert_nil store.most_recent_name
    end
  end

  def test_rejects_a_directory_outside_the_application
    Dir.mktmpdir do |root|
      error = assert_raises(CanvasERD::DiagramStore::Error) do
        CanvasERD::DiagramStore.new(root: root, directory: "../diagrams")
      end

      assert_includes error.message, "inside the Rails application"
    end
  end

  private

  def editable_png
    signature = CanvasERD::PngDocument::SIGNATURE
    signature +
      chunk("iTXt", CanvasERD::PngDocument::ITXT_PREFIX + JSON.generate(DOCUMENT)) +
      chunk("IEND", "")
  end

  def chunk(type, data)
    data = data.b
    [data.bytesize].pack("N") + type + data + [Zlib.crc32(type + data)].pack("N")
  end
end
