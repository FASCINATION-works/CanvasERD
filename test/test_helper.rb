# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

rails_erd_reference = File.expand_path("../../rails-erd/lib", __dir__)
$LOAD_PATH.unshift rails_erd_reference if File.directory?(rails_erd_reference)

require "minitest/autorun"
require "canvas_erd"
