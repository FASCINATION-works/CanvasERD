# frozen_string_literal: true

module CanvasERD
  class ApplicationLoader
    class Error < StandardError; end

    attr_reader :root

    def initialize(root = Dir.pwd)
      @root = File.expand_path(root)
    end

    def load
      environment_path = File.join(root, "config", "environment.rb")
      unless File.file?(environment_path)
        raise Error, "Rails application environment not found at #{environment_path}"
      end

      require environment_path
      eager_load_rails_application
      true
    end

    private

    def eager_load_rails_application
      return unless defined?(Rails) && Rails.respond_to?(:application) && Rails.application

      Rails.application.eager_load!

      config = Rails.application.config
      return unless config.respond_to?(:eager_load_namespaces)

      config.eager_load_namespaces.each(&:eager_load!)
    end
  end
end
