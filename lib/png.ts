import { deflateSync } from "node:zlib";

// Minimal PNG encoder for the raw bitmaps pdf.js hands back.
//
// NTA's question papers hold every stem and option as an embedded image, and pdf.js decodes
// those to raw pixel buffers rather than the original JPEG bytes. To send one to a vision
// model it has to be re-encoded, and PNG is the only lossless container we can write without
// pulling in an image dependency — Node already ships zlib, which is all PNG needs.
//
// Deliberately not a general encoder: no palette, no interlacing, no 16-bit channels, and
// filter type 0 on every scanline. The input is screenshot-like text renderings, where a
// smarter filter buys little and costs clarity.

// pdf.js ImageKind. 1 is 1-byte-per-pixel greyscale, 2 is packed RGB, 3 is RGBA.
export const IMAGE_KIND = { GRAYSCALE_1BPP: 1, RGB_24BPP: 2, RGBA_32BPP: 3 } as const;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

export type Bitmap = {
  width: number;
  height: number;
  // pdf.js `kind`; anything unrecognised is treated as RGB.
  kind: number;
  data: Uint8Array | Uint8ClampedArray;
};

// Expands whatever pdf.js gave us into flat RGB triples, one row at a time.
function toRgbRows(bitmap: Bitmap) {
  const { width, height, kind, data } = bitmap;
  const rows: Buffer[] = [];

  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(width * 3);
    for (let x = 0; x < width; x += 1) {
      const out = x * 3;
      if (kind === IMAGE_KIND.GRAYSCALE_1BPP) {
        const value = data[y * width + x] ?? 0;
        row[out] = value;
        row[out + 1] = value;
        row[out + 2] = value;
      } else if (kind === IMAGE_KIND.RGBA_32BPP) {
        const from = (y * width + x) * 4;
        // Composite onto white. These renderings are black text on a transparent or white
        // ground; compositing onto black would invert them into something unreadable.
        const alpha = (data[from + 3] ?? 255) / 255;
        row[out] = Math.round((data[from] ?? 0) * alpha + 255 * (1 - alpha));
        row[out + 1] = Math.round((data[from + 1] ?? 0) * alpha + 255 * (1 - alpha));
        row[out + 2] = Math.round((data[from + 2] ?? 0) * alpha + 255 * (1 - alpha));
      } else {
        const from = (y * width + x) * 3;
        row[out] = data[from] ?? 0;
        row[out + 1] = data[from + 1] ?? 0;
        row[out + 2] = data[from + 2] ?? 0;
      }
    }
    rows.push(row);
  }

  return rows;
}

export function encodePng(bitmap: Bitmap): Buffer {
  const { width, height } = bitmap;
  if (width <= 0 || height <= 0) throw new Error("Cannot encode a zero-sized bitmap");

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Every scanline is prefixed with its filter byte; 0 means "none".
  const filterByte = Buffer.from([0]);
  const raw = Buffer.concat(toRgbRows(bitmap).flatMap((row) => [filterByte, row]));

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
