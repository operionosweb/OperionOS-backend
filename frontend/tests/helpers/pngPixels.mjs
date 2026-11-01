import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";

export function decodeScreenshot(png) {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  const channels = png[25] === 6 ? 4 : 3;
  assert.ok([2, 6].includes(png[25]) && png[24] === 8, "Screenshot is an 8-bit RGB/RGBA PNG");
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset), type = png.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += 12 + size;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let prior = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], row = pixels.subarray(y * stride, (y + 1) * stride);
    assert.ok(filter <= 4, "Supported PNG row filter");
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0, up = prior[x], upperLeft = x >= channels ? prior[x - channels] : 0;
      const p = left + up - upperLeft;
      const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upperLeft);
      const prediction = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft;
      row[x] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
    prior = row;
  }
  return { width, height, channels, pixels };
}

export function texturedPixelStats(png) {
  const { width, height, channels, pixels } = decodeScreenshot(png);
  const colors = new Set();
  let colored = 0, sampled = 0;
  for (let y = 0.25; y < 0.75; y += 0.025) for (let x = 0.25; x < 0.75; x += 0.025) {
    const offset = (Math.floor(height * y) * width + Math.floor(width * x)) * channels;
    const pixel = pixels.subarray(offset, offset + 3);
    colors.add([...pixel].join(","));
    if (Math.max(...pixel) - Math.min(...pixel) > 25 && Math.max(...pixel) < 235) colored++;
    sampled++;
  }
  return { colors: colors.size, colored: colored / sampled };
}
