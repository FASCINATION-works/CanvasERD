# frozen_string_literal: true

require "digest"
require "open3"
require_relative "test_helper"

class PackageTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  FABRIC_ASSET = "lib/canvas_erd/web/vendor/fabric.min.js"
  FABRIC_LICENSE = "licenses/FABRIC-JS-LICENSE.txt"
  ELK_API_ASSET = "lib/canvas_erd/web/vendor/elk-api.js"
  ELK_WORKER_ASSET = "lib/canvas_erd/web/vendor/elk-worker.min.js"
  ELK_LICENSE = "licenses/ELKJS-LICENSE.md"
  HOMEPAGE = "https://github.com/FASCINATION-works/CanvasERD"

  def test_gemspec_packages_the_executable_and_vendored_files
    spec = Gem::Specification.load(File.join(ROOT, "canvas_erd.gemspec"))

    assert_includes spec.files, "exe/canvas_erd"
    assert_includes spec.files, FABRIC_ASSET
    assert_includes spec.files, FABRIC_LICENSE
    assert_includes spec.files, ELK_API_ASSET
    assert_includes spec.files, ELK_WORKER_ASSET
    assert_includes spec.files, ELK_LICENSE
    assert_includes spec.files, "LICENSE"
    assert_includes spec.files, "CHANGELOG.md"
    assert_equal ["canvas_erd"], spec.executables
  end

  def test_release_metadata
    spec = Gem::Specification.load(File.join(ROOT, "canvas_erd.gemspec"))

    assert_equal "MIT", spec.license
    assert_equal HOMEPAGE, spec.homepage
    assert_equal HOMEPAGE, spec.metadata.fetch("source_code_uri")
    assert_equal "#{HOMEPAGE}/blob/main/CHANGELOG.md", spec.metadata.fetch("changelog_uri")
    assert_equal "#{HOMEPAGE}/issues", spec.metadata.fetch("bug_tracker_uri")
    assert_equal "true", spec.metadata.fetch("rubygems_mfa_required")
  end

  def test_vendored_fabric_asset_matches_version_7_4_0_build
    checksum = Digest::SHA256.file(File.join(ROOT, FABRIC_ASSET)).hexdigest

    assert_equal "fdeef36561634aacd91520540a66d1ac3345b77a0ad35c754d5375f6062c16fc", checksum
  end

  def test_vendored_elk_assets_match_version_0_12_0_build
    assert_equal "ccca46175c05bbd280b5de6c9853103711e52c666a101f145b717e345363e24d",
      Digest::SHA256.file(File.join(ROOT, ELK_API_ASSET)).hexdigest
    assert_equal "e4f5c51c6f2fd564bb64e52e81c4a85a316ef2f24f8b90e1db5eb886c765b030",
      Digest::SHA256.file(File.join(ROOT, ELK_WORKER_ASSET)).hexdigest
  end

  def test_runtime_dependency_versions_are_constrained
    spec = Gem::Specification.load(File.join(ROOT, "canvas_erd.gemspec"))
    dependencies = spec.runtime_dependencies.to_h { |dependency| [dependency.name, dependency.requirement.to_s] }

    assert_equal "~> 2.1", dependencies.fetch("rails-erd")
    assert_equal ">= 2.2, < 4", dependencies.fetch("rack")
    refute dependencies.key?("webrick")
  end

  def test_standard_bundler_gem_tasks_are_available
    output, error, status = Open3.capture3("bundle", "exec", "rake", "-T", chdir: ROOT)

    assert status.success?, error
    %w[build build:checksum clean clobber install install:local release].each do |task|
      assert_match(/^rake #{Regexp.escape(task)}(?:\[remote\])?\s/, output)
    end
  end
end
