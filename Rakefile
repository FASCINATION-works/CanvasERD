# frozen_string_literal: true

require "rake/testtask"

Rake::TestTask.new do |task|
  task.libs << "test"
  task.test_files = FileList["test/**/*_test.rb"]
end

task :test_javascript do
  files = FileList["test/javascript/**/*_test.js"]
  sh "node", "--test", *files
end

Rake::Task[:test].enhance([:test_javascript])

task default: :test
