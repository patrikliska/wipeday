/** Reads just enough of an image or font header to say what the file is. */

export type Sniffed =
  | { kind: "png" | "jpg"; width: number; height: number }
  | { kind: "font" }
  | { kind: "unknown" };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FONT_TAGS = ["\u0000\u0001\u0000\u0000", "OTTO", "true", "ttcf"];

export function sniff(bytes: Buffer): Sniffed {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    // IHDR is always the first chunk: width and height at fixed offsets.
    return { kind: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const size = jpegSize(bytes);
    return size ? { kind: "jpg", ...size } : { kind: "unknown" };
  }
  if (bytes.length >= 4 && FONT_TAGS.includes(bytes.subarray(0, 4).toString("latin1"))) {
    return { kind: "font" };
  }
  return { kind: "unknown" };
}

/** Walks JPEG segments to the first start-of-frame marker, which holds the size. */
function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  return null;
}
