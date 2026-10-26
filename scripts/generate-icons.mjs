import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "apps", "web", "public");

const ACCENT = [0x57, 0x51, 0xc7, 255];
const WHITE = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function insideRoundRect(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function mix(from, to, t) {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
    from[3] + (to[3] - from[3]) * t,
  ];
}

const SAMPLES = 4;

function renderIcon(size, { fullBleed = false, padding = 0 } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 32;
  const radius = fullBleed ? 0 : 9 * scale;
  const inset = padding * scale;

  const barX = 8 * scale + inset * 0.5;
  const barWidths = [16, 11, 6].map((value) => value * scale);
  const barHeight = 3.2 * scale;
  const barYs = [9.5, 14.6, 19.7].map((value) => value * scale + inset * 0.5);
  const barOpacities = [1, 0.82, 0.64];

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = px + (sx + 0.5) / SAMPLES;
          const y = py + (sy + 0.5) / SAMPLES;
          let color = TRANSPARENT;

          if (insideRoundRect(x, y, inset, inset, size - inset * 2, size - inset * 2, radius)) {
            color = ACCENT;
            for (let bar = 0; bar < 3; bar += 1) {
              const bx = fullBleed ? 8 * scale : barX;
              const by = fullBleed ? barYs[bar] - padding * scale * 0.5 : barYs[bar];
              if (
                insideRoundRect(x, y, bx, by, barWidths[bar], barHeight, barHeight / 2)
              ) {
                color = mix(ACCENT, WHITE, barOpacities[bar]);
              }
            }
          }

          r += color[0];
          g += color[1];
          b += color[2];
          a += color[3];
        }
      }

      const samples = SAMPLES * SAMPLES;
      const offset = (py * size + px) * 4;
      pixels[offset] = Math.round(r / samples);
      pixels[offset + 1] = Math.round(g / samples);
      pixels[offset + 2] = Math.round(b / samples);
      pixels[offset + 3] = Math.round(a / samples);
    }
  }

  return encodePng(size, size, pixels);
}

mkdirSync(PUBLIC_DIR, { recursive: true });

writeFileSync(join(PUBLIC_DIR, "icon-192.png"), renderIcon(192));
writeFileSync(join(PUBLIC_DIR, "icon-512.png"), renderIcon(512));
writeFileSync(join(PUBLIC_DIR, "icon-maskable-512.png"), renderIcon(512, { fullBleed: true, padding: 6 }));

console.log("Icons generated in apps/web/public");
