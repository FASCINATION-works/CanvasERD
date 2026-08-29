# frozen_string_literal: true

require "rails_erd/diagram"

module CanvasERD
  class Diagram < RailsERD::Diagram
    setup do
      @entity_ids = {}
      @schema = {
        "name" => domain.name,
        "entities" => [],
        "relationships" => [],
        "specializations" => []
      }
    end

    each_entity do |entity, attributes|
      @entity_ids[entity.name.to_s] = true
      @schema["entities"] << entity_data(entity, attributes)
    end

    each_specialization do |specialization|
      next unless included_entity?(specialization.generalized) && included_entity?(specialization.specialized)

      @schema["specializations"] << specialization_data(specialization)
    end

    each_relationship do |relationship|
      next unless included_entity?(relationship.source) && included_entity?(relationship.destination)

      @schema["relationships"] << relationship_data(relationship)
    end

    save do
      @schema["entities"].sort_by! { |entity| entity.fetch("id") }
      @schema["relationships"].sort_by! { |relationship| relationship.fetch("id") }
      @schema["specializations"].sort_by! { |specialization| specialization.fetch("id") }
      @schema
    end

    private

    def entity_data(entity, attributes)
      {
        "id" => entity.name.to_s,
        "name" => entity.name.to_s,
        "label" => entity_label(entity),
        "table_name" => entity.model&.table_name,
        "namespace" => entity.namespace,
        "virtual" => entity.virtual?,
        "generalized" => entity.generalized?,
        "specialized" => entity.specialized?,
        "attributes" => attributes.map { |attribute| attribute_data(entity, attribute) }
      }
    end

    def entity_label(entity)
      if options[:table_names] && entity.model
        entity.model.table_name
      else
        entity.name.to_s
      end
    end

    def attribute_data(entity, attribute)
      {
        "id" => "#{entity.name}.#{attribute.name}",
        "name" => attribute.name.to_s,
        "type" => attribute.type.to_s,
        "type_description" => attribute.type_description,
        "primary_key" => attribute.primary_key?,
        "foreign_key" => attribute.foreign_key?,
        "mandatory" => attribute.mandatory?,
        "unique" => attribute.unique?,
        "timestamp" => attribute.timestamp?,
        "inheritance" => attribute.inheritance?
      }
    end

    def relationship_data(relationship)
      source_id = relationship.source.name.to_s
      destination_id = relationship.destination.name.to_s

      {
        "id" => endpoint_id("relationship", source_id, destination_id),
        "source_id" => source_id,
        "destination_id" => destination_id,
        "cardinality" => cardinality_data(relationship.cardinality),
        "indirect" => relationship.indirect?,
        "mutual" => relationship.mutual?,
        "recursive" => relationship.recursive?
      }
    end

    def cardinality_data(cardinality)
      {
        "name" => cardinality.name.to_s,
        "source" => range_data(cardinality.source_range),
        "destination" => range_data(cardinality.destination_range)
      }
    end

    def range_data(range)
      {
        "minimum" => range.begin,
        "maximum" => range.end.finite? ? range.end : nil
      }
    end

    def specialization_data(specialization)
      generalized_id = specialization.generalized.name.to_s
      specialized_id = specialization.specialized.name.to_s

      {
        "id" => endpoint_id("specialization", generalized_id, specialized_id),
        "generalized_id" => generalized_id,
        "specialized_id" => specialized_id,
        "type" => specialization.inheritance? ? "inheritance" : "polymorphic"
      }
    end

    def included_entity?(entity)
      entity && @entity_ids.key?(entity.name.to_s)
    end

    def endpoint_id(kind, first_id, second_id)
      "#{kind}:#{[first_id, second_id].sort.join('|')}"
    end
  end
end
