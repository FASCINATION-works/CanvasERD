# frozen_string_literal: true

require_relative "lib/canvas_erd/version"

Gem::Specification.new do |spec|
  spec.name = "canvas_erd"
  spec.version = CanvasERD::VERSION
  spec.authors = ["Marc Heiligers"]

  spec.summary = "Edit Rails ERD diagrams on an interactive canvas"
  spec.description = "A local browser-based editor for diagrams generated from Rails ERD domain models."
  spec.homepage = "https://github.com/FASCINATION-works/CanvasERD"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.1"

  spec.files = Dir[
    "exe/*",
    "lib/**/*",
    "licenses/*",
    "CHANGELOG.md",
    "LICENSE",
    "README.md"
  ].sort
  spec.bindir = "exe"
  spec.executables = ["canvas_erd"]
  spec.require_paths = ["lib"]

  spec.metadata["rubygems_mfa_required"] = "true"
  spec.metadata["source_code_uri"] = spec.homepage
  spec.metadata["changelog_uri"] = "#{spec.homepage}/blob/main/CHANGELOG.md"
  spec.metadata["bug_tracker_uri"] = "#{spec.homepage}/issues"

  spec.add_dependency "rails-erd", "~> 2.1"
  spec.add_dependency "rack", ">= 2.2", "< 4"

  spec.add_development_dependency "minitest", "~> 5.20"
  spec.add_development_dependency "rake", "~> 13.0"
  spec.add_development_dependency "sqlite3", ">= 1.4", "< 3"
end
