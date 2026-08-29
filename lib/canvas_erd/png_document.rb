# frozen_string_literal: true

require "json"
require "zlib"

module CanvasERD
  class PngDocument
    class Error < StandardError; end

    SIGNATURE = "\x89PNG\r\n\x1a\n".b
    KEYWORD = "CanvasERD"
    ITXT_PREFIX = "#{KEYWORD}\0\0\0\0\0".b
    MAX_CHUNK_SIZE = 64 * 1024 * 1024

    def self.load(path)
      File.open(path, "rb") { |file| read(file) }
    rescue SystemCallError => error
      raise Error, "Could not read diagram #{path}: #{error.message}"
    end

    def self.read(input)
      raise Error, "Not a PNG file" unless input.read(SIGNATURE.bytesize) == SIGNATURE

      document_json = nil
      found_end = false

      until found_end
        length_bytes = input.read(4)
        raise Error, "PNG ended before its IEND chunk" unless length_bytes&.bytesize == 4

        length = length_bytes.unpack1("N")
        raise Error, "PNG chunk is too large" if length > MAX_CHUNK_SIZE

        type = read_exact(input, 4)
        data = read_exact(input, length)
        checksum = read_exact(input, 4).unpack1("N")
        raise Error, "PNG chunk checksum is invalid" unless Zlib.crc32(type + data) == checksum

        if type == "iTXt" && data.start_with?(ITXT_PREFIX)
          document_json = data.delete_prefix(ITXT_PREFIX).force_encoding(Encoding::UTF_8)
        end
        found_end = type == "IEND"
      end

      raise Error, "PNG does not contain an editable CanvasERD diagram" unless document_json

      validate(JSON.parse(document_json))
    rescue JSON::ParserError => error
      raise Error, "CanvasERD diagram metadata is invalid: #{error.message}"
    end

    def self.read_exact(input, length)
      value = input.read(length)
      raise Error, "PNG chunk is truncated" unless value&.bytesize == length

      value
    end
    private_class_method :read_exact

    def self.validate(document)
      schema = document["schema"] if document.is_a?(Hash)
      state = document["state"] if document.is_a?(Hash)
      valid = document.is_a?(Hash) &&
        document["format"] == "canvas_erd" &&
        document["version"] == 1 &&
        schema.is_a?(Hash) &&
        schema["entities"].is_a?(Array) &&
        schema["relationships"].is_a?(Array) &&
        schema["specializations"].is_a?(Array) &&
        state.is_a?(Hash) &&
        state["includedEntityIds"].is_a?(Array) &&
        state["positions"].is_a?(Hash) &&
        state["notes"].is_a?(Array)
      raise Error, "CanvasERD diagram format is not supported" unless valid

      document
    end
    private_class_method :validate
  end
end
