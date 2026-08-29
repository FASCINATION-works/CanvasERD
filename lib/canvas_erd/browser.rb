# frozen_string_literal: true

require "rbconfig"

module CanvasERD
  class Browser
    def self.open(url)
      new.open(url)
    end

    def initialize(host_os: RbConfig::CONFIG.fetch("host_os"), process_spawn: Process.method(:spawn))
      @host_os = host_os
      @process_spawn = process_spawn
    end

    def open(url)
      command = command_for(url)
      return false unless command

      process_id = @process_spawn.call(*command, out: File::NULL, err: File::NULL)
      Process.detach(process_id) if process_id.is_a?(Integer)
      true
    rescue SystemCallError
      false
    end

    private

    def command_for(url)
      case @host_os
      when /darwin/
        ["open", url]
      when /linux|bsd/
        ["xdg-open", url]
      when /mswin|mingw|cygwin/
        ["cmd", "/c", "start", "", url]
      end
    end
  end
end
