# frozen_string_literal: true

require "active_record"
require "json"
require "rails_erd/version"
require_relative "test_helper"

class DiagramTest < Minitest::Test
  def setup
    ActiveRecord::Base.establish_connection(adapter: "sqlite3", database: ":memory:")
    @schema_verbose = ActiveRecord::Schema.verbose
    ActiveRecord::Schema.verbose = false
    RailsERD.options = RailsERD.default_options
  end

  def teardown
    %i[Book Author Dog Animal Picture Post].each do |name|
      Object.send(:remove_const, name) if Object.const_defined?(name, false)
    end

    ActiveRecord::Schema.verbose = @schema_verbose
    ActiveRecord::Base.connection.disconnect!
  end

  def test_serializes_entities_attributes_and_relationships
    create_author_and_book_models

    schema = diagram_for(
      [Book, Author],
      attributes: %i[primary_keys foreign_keys content],
      disconnected: true
    )

    assert_equal ["Author", "Book"], schema.fetch("entities").map { |entity| entity.fetch("id") }

    book = schema.fetch("entities").find { |entity| entity.fetch("id") == "Book" }
    assert_equal "books", book.fetch("table_name")
    assert_equal false, book.fetch("virtual")

    id = book.fetch("attributes").find { |attribute| attribute.fetch("name") == "id" }
    assert_equal "Book.id", id.fetch("id")
    assert id.fetch("primary_key")

    author_id = book.fetch("attributes").find { |attribute| attribute.fetch("name") == "author_id" }
    assert author_id.fetch("foreign_key")
    assert author_id.fetch("mandatory")

    relationship = schema.fetch("relationships").fetch(0)
    assert_equal "relationship:Author|Book", relationship.fetch("id")
    assert_equal "Author", relationship.fetch("source_id")
    assert_equal "Book", relationship.fetch("destination_id")
    assert_equal "one_to_many", relationship.dig("cardinality", "name")
    assert_nil relationship.dig("cardinality", "destination", "maximum")
    assert_equal false, relationship.fetch("indirect")

    assert_equal schema, JSON.parse(JSON.generate(schema))
  end

  def test_respects_rails_erd_entity_and_attribute_filters
    skip "only_attributes requires Rails ERD 2.2" if Gem::Version.new(RailsERD::VERSION) < Gem::Version.new("2.2")

    create_author_and_book_models

    schema = diagram_for(
      [Book, Author],
      only: ["Book"],
      attributes: %i[primary_keys content],
      only_attributes: { "Book" => ["title"] },
      disconnected: true
    )

    assert_equal ["Book"], schema.fetch("entities").map { |entity| entity.fetch("id") }
    assert_equal ["title"], schema.dig("entities", 0, "attributes").map { |attribute| attribute.fetch("name") }
    assert_empty schema.fetch("relationships")
  end

  def test_uses_table_names_for_labels_when_requested
    create_author_and_book_models

    schema = diagram_for([Book, Author], table_names: true, disconnected: true)

    labels = schema.fetch("entities").to_h { |entity| [entity.fetch("id"), entity.fetch("label")] }
    assert_equal({ "Author" => "authors", "Book" => "books" }, labels)
  end

  def test_serializes_inheritance_specializations
    create_inheritance_models

    schema = diagram_for([Dog, Animal], inheritance: true, disconnected: true)

    specialization = schema.fetch("specializations").fetch(0)
    assert_equal "specialization:Animal|Dog", specialization.fetch("id")
    assert_equal "Animal", specialization.fetch("generalized_id")
    assert_equal "Dog", specialization.fetch("specialized_id")
    assert_equal "inheritance", specialization.fetch("type")

    filtered_schema = diagram_for([Dog, Animal], inheritance: true, only: ["Dog"], disconnected: true)
    assert_empty filtered_schema.fetch("specializations")
  end

  def test_serializes_polymorphic_specializations
    create_polymorphic_models

    schema = diagram_for([Picture, Post], polymorphism: true, disconnected: true)

    specialization = schema.fetch("specializations").fetch(0)
    assert_equal "specialization:Imageable|Post", specialization.fetch("id")
    assert_equal "Imageable", specialization.fetch("generalized_id")
    assert_equal "Post", specialization.fetch("specialized_id")
    assert_equal "polymorphic", specialization.fetch("type")
  end

  private

  def diagram_for(models, options = {})
    domain = RailsERD::Domain.new(models, options)
    CanvasERD::Diagram.new(domain, options).create
  end

  def create_author_and_book_models
    ActiveRecord::Schema.define do
      create_table :authors do |table|
        table.string :name, null: false
      end

      create_table :books do |table|
        table.references :author, null: false
        table.string :title, null: false
      end
    end

    Object.const_set(:Author, Class.new(ActiveRecord::Base) do
      has_many :books
    end)

    Object.const_set(:Book, Class.new(ActiveRecord::Base) do
      belongs_to :author
    end)
  end

  def create_inheritance_models
    ActiveRecord::Schema.define do
      create_table :animals do |table|
        table.string :type
        table.string :name
      end
    end

    Object.const_set(:Animal, Class.new(ActiveRecord::Base))
    Object.const_set(:Dog, Class.new(Animal))
  end

  def create_polymorphic_models
    ActiveRecord::Schema.define do
      create_table :posts

      create_table :pictures do |table|
        table.references :imageable, polymorphic: true
      end
    end

    Object.const_set(:Post, Class.new(ActiveRecord::Base) do
      has_many :pictures, as: :imageable
    end)

    Object.const_set(:Picture, Class.new(ActiveRecord::Base) do
      belongs_to :imageable, polymorphic: true
    end)
  end
end
