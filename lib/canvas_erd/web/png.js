(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CanvasERDPng = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const KEYWORD = "CanvasERD";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const crcTable = new Uint32Array(256);

  for (let number = 0; number < 256; number += 1) {
    let value = number;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    crcTable[number] = value >>> 0;
  }

  function concatenate(parts) {
    const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    parts.forEach((part) => {
      result.set(part, offset);
      offset += part.length;
    });
    return result;
  }

  function readUint32(bytes, offset) {
    return (
      bytes[offset] * 0x1000000 +
      (bytes[offset + 1] << 16) +
      (bytes[offset + 2] << 8) +
      bytes[offset + 3]
    ) >>> 0;
  }

  function writeUint32(value) {
    return new Uint8Array([
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff
    ]);
  }

  function crc32(bytes) {
    let checksum = 0xffffffff;
    bytes.forEach((byte) => {
      checksum = crcTable[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
    });
    return (checksum ^ 0xffffffff) >>> 0;
  }

  function chunks(bytes) {
    if (SIGNATURE.some((byte, index) => bytes[index] !== byte)) throw new Error("Not a PNG file");

    const result = [];
    let offset = SIGNATURE.length;
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length) throw new Error("PNG chunk is truncated");
      const length = readUint32(bytes, offset);
      const end = offset + 12 + length;
      if (end > bytes.length) throw new Error("PNG chunk is truncated");

      const typeBytes = bytes.slice(offset + 4, offset + 8);
      const data = bytes.slice(offset + 8, offset + 8 + length);
      const checksum = readUint32(bytes, offset + 8 + length);
      if (crc32(concatenate([typeBytes, data])) !== checksum) throw new Error("PNG chunk checksum is invalid");

      const type = String.fromCharCode(...typeBytes);
      result.push({ type, data, offset, end });
      offset = end;
      if (type === "IEND") return result;
    }
    throw new Error("PNG ended before its IEND chunk");
  }

  function createChunk(type, data) {
    const typeBytes = encoder.encode(type);
    return concatenate([
      writeUint32(data.length),
      typeBytes,
      data,
      writeUint32(crc32(concatenate([typeBytes, data])))
    ]);
  }

  function metadataData(documentData) {
    return concatenate([
      encoder.encode(KEYWORD),
      new Uint8Array(5),
      encoder.encode(JSON.stringify(documentData))
    ]);
  }

  function embedDocument(pngBytes, documentData) {
    const parsedChunks = chunks(pngBytes);
    const endChunk = parsedChunks.find((chunk) => chunk.type === "IEND");
    const metadataChunk = createChunk("iTXt", metadataData(documentData));
    return concatenate([
      pngBytes.slice(0, endChunk.offset),
      metadataChunk,
      pngBytes.slice(endChunk.offset)
    ]);
  }

  function extractDocument(pngBytes) {
    const prefix = metadataData({}).slice(0, encoder.encode(KEYWORD).length + 5);
    let json;
    chunks(pngBytes).forEach((chunk) => {
      const matches = chunk.type === "iTXt" && prefix.every((byte, index) => chunk.data[index] === byte);
      if (matches) json = decoder.decode(chunk.data.slice(prefix.length));
    });
    if (!json) throw new Error("PNG does not contain an editable CanvasERD diagram");
    return JSON.parse(json);
  }

  function bytesFromDataUrl(dataUrl) {
    const marker = "data:image/png;base64,";
    if (!dataUrl.startsWith(marker)) throw new Error("Expected a PNG data URL");
    const binary = atob(dataUrl.slice(marker.length));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  return {
    embedDocument,
    extractDocument,
    bytesFromDataUrl
  };
});
