# frozen_string_literal: true

require_relative "lib/canvas_erd/version"

Gem::Specification.new do |spec|
  spec.name = "canvas_erd"
  spec.version = CanvasERD::VERSION
  spec.authors = ["CanvasERD contributors"]

  spec.summary = "Edit Rails ERD diagrams on an interactive canvas"
  spec.description = "A local browser-based editor for diagrams generated from Rails ERD domain models."
  spec.required_ruby_version = ">= 3.1"

  spec.files = Dir[
    "exe/*",
    "lib/**/*",
    "licenses/*",
    "README.md"
  ].sort
  spec.bindir = "exe"
  spec.executables = ["canvas_erd"]
  spec.require_paths = ["lib"]

  spec.metadata["rubygems_mfa_required"] = "true"

  spec.add_dependency "rails-erd", "~> 2.2"
  spec.add_dependency "webrick", "~> 1.9"

  spec.add_development_dependency "minitest", "~> 5.20"
  spec.add_development_dependency "rake", "~> 13.0"
  spec.add_development_dependency "sqlite3", ">= 1.4", "< 3"
end
