# frozen_string_literal: true

require "digest"
require_relative "test_helper"

class PackageTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  FABRIC_ASSET = "lib/canvas_erd/web/vendor/fabric.min.js"
  FABRIC_LICENSE = "licenses/FABRIC-JS-LICENSE.txt"

  def test_gemspec_packages_the_executable_and_fabric_files
    spec = Gem::Specification.load(File.join(ROOT, "canvas_erd.gemspec"))

    assert_includes spec.files, "exe/canvas_erd"
    assert_includes spec.files, FABRIC_ASSET
    assert_includes spec.files, FABRIC_LICENSE
    assert_equal ["canvas_erd"], spec.executables
  end

  def test_vendored_fabric_asset_matches_version_7_4_0_build
    checksum = Digest::SHA256.file(File.join(ROOT, FABRIC_ASSET)).hexdigest

    assert_equal "fdeef36561634aacd91520540a66d1ac3345b77a0ad35c754d5375f6062c16fc", checksum
  end

  def test_runtime_dependency_versions_are_constrained
    spec = Gem::Specification.load(File.join(ROOT, "canvas_erd.gemspec"))
    dependencies = spec.runtime_dependencies.to_h { |dependency| [dependency.name, dependency.requirement.to_s] }

    assert_equal "~> 2.2", dependencies.fetch("rails-erd")
    assert_equal ">= 2.2, < 4", dependencies.fetch("rack")
    refute dependencies.key?("webrick")
  end
end
