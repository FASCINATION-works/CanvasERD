# frozen_string_literal: true

require_relative "test_helper"

class SchemaProviderTest < Minitest::Test
  def test_resets_model_columns_before_generating_the_schema
    events = []
    model = Object.new
    model.define_singleton_method(:reset_column_information) { events << :reset }
    schema = { "entities" => [] }
    provider = CanvasERD::SchemaProvider.new(
      models: -> { [model] },
      diagram: -> { events << :diagram; schema }
    )

    assert_same schema, provider.call
    assert_equal %i[reset diagram], events
  end
end
