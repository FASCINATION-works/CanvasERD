# frozen_string_literal: true

require "fileutils"
require "tmpdir"
require_relative "test_helper"

class ModelDetailsTest < Minitest::Test
  class RecordedModel
    def self.scope(name, body)
      :defined
    end
    singleton_class.prepend(CanvasERD::ModelDetails::ScopeRecorder)
  end

  def teardown
    CanvasERD::ModelDetails.scopes.delete(RecordedModel.name)
  end

  def test_records_scope_declarations_with_their_location
    line = __LINE__ + 1
    result = RecordedModel.scope(:published, -> {})

    assert_equal :defined, result
    assert_equal [{ name: "published", path: File.realpath(__FILE__), line: line }],
      CanvasERD::ModelDetails.scopes[RecordedModel.name]
  end

  def test_extracts_multi_line_scope_source_grouped_by_file
    Dir.mktmpdir do |directory|
      root = File.realpath(directory)
      model = write(root, "app/models/book.rb", <<~RUBY)
        class Book < ApplicationRecord
          include Publishable

          scope :recent, -> { order(created_at: :desc) }
          scope :with_counts, lambda {
            select("books.*")
          }
        end
      RUBY
      concern = write(root, "app/models/concerns/publishable.rb", <<~RUBY)
        module Publishable
          included do
            scope :published, -> { where.not(published_at: nil) }
          end
        end
      RUBY
      scopes = {
        "Book" => [
          { name: "published", path: concern, line: 3 },
          { name: "recent", path: model, line: 4 },
          { name: "with_counts", path: model, line: 5 },
          { name: "status", path: "/gems/active_record/enum.rb", line: 1 }
        ]
      }
      details = CanvasERD::ModelDetails.new(root: root, scopes: scopes, source_path: ->(_model) { model })

      assert_equal({ "Book" => { "scopes" => 3 } }, details.summary)
      assert_equal [nil, 3, nil, 4, 5, 6, 7], details.detail("Book", "scopes")["lineNumbers"]
      assert_equal <<~RUBY.chomp, details.detail("Book", "scopes")["code"]
        # app/models/concerns/publishable.rb
        scope :published, -> { where.not(published_at: nil) }

        scope :recent, -> { order(created_at: :desc) }
        scope :with_counts, lambda {
          select("books.*")
        }
      RUBY
    end
  end

  def test_rejects_unknown_models_and_details
    details = CanvasERD::ModelDetails.new(root: Dir.pwd, scopes: {}, source_path: ->(_model) {})

    assert_raises(CanvasERD::ModelDetails::NotFound) { details.detail("Book", "scopes") }
    assert_raises(CanvasERD::ModelDetails::NotFound) { details.detail("Book", "callbacks") }
  end

  private

  def write(root, relative_path, content)
    path = File.join(root, relative_path)
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
    path
  end
end
