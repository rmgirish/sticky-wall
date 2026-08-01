const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const s = size;
  const raw = Buffer.alloc(s * (s * 4 + 1));
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.42;
  const R = size === 256 ? 6 : Math.max(1, Math.round(size / 40));
  let o = 0;
  for (let y = 0; y < s; y++) {
    raw[o++] = 0;
    for (let x = 0; x < s; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let px = [0, 0, 0, 0];
      if (d <= r) {
        const shade = Math.max(0, Math.min(1, 1 - d / (r * 2.2)));
        px = [Math.round(255 - shade * 26), Math.round(213 - shade * 18), Math.round(79 + shade * 20), 255];
      } else if (d <= r * 1.14) {
        px = [150, 111, 22, 255];
      }
      if (px[3] === 255) {
        const pinD = Math.sqrt((x - cx) * (x - cx) + (y - (cy - r * 0.45)) * (y - (cy - r * 0.45)));
        if (pinD <= r * 0.16) {
          px = [216, 51, 58, 255];
          if (pinD <= r * 0.07) px = [255, 157, 157, 255];
        }
        for (const [ex, ey, er] of [[cx + r * 0.62, cy + r * 0.5, r * 0.14], [cx - r * 0.6, cy + r * 0.45, r * 0.11]]) {
          const dd = Math.sqrt((x - ex) * (x - ex) + (y - ey) * (y - ey));
          if (dd <= er) {
            const s2 = Math.max(0, Math.min(1, 1 - dd / (er * 2)));
            px = [Math.round(255 - s2 * 22), Math.round(213 - s2 * 14), Math.round(79 + s2 * 24), 255];
          }
        }
      }
      raw[o++] = px[0];
      raw[o++] = px[1];
      raw[o++] = px[2];
      raw[o++] = px[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

const outDir = path.join(__dirname, 'build');
fs.mkdirSync(outDir, { recursive: true });
const png256 = makePng(256);
fs.writeFileSync(path.join(outDir, 'icon.png'), png256);
fs.writeFileSync(path.join(outDir, 'icon.ico'), makeIco(png256, 256));
console.log('icon.ico and icon.png written to build/');
