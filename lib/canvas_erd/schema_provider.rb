# frozen_string_literal: true

module CanvasERD
  class SchemaProvider
    def initialize(models: -> { ActiveRecord::Base.descendants }, diagram: -> { CanvasERD::Diagram.create })
      @models = models
      @diagram = diagram
    end

    def call
      @models.call.each(&:reset_column_information)
      @diagram.call
    end
  end
end
