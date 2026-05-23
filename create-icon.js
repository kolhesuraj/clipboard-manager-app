#!/usr/bin/env node
// Generates tray icons at startup (run via postinstall).
//   resources/icon-light.png  — indigo bg + white lines  (light desktop)
//   resources/icon-dark.png   — white  bg + indigo lines (dark  desktop)
//   resources/icon.png        — alias to icon-light.png  (default fallback)

const fs   = require('fs')
const zlib = require('zlib')
const path = require('path')

// ── PNG helpers ────────────────────────────────────────────────────────────────
const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) | 0
}
function pngChunk(type, data) {
  const tb = Buffer.from(type, 'ascii')
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length, 0)
  const cb = Buffer.alloc(4); cb.writeInt32BE(crc32(Buffer.concat([tb, data])), 0)
  return Buffer.concat([lb, tb, data, cb])
}
function makePng(pixels, w, h) {
  const rows = []
  for (let y = 0; y < h; y++) {
    rows.push(0)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      rows.push(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3])
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.from(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Icon geometry (64×64, mirrors SVG viewBox 28×28 scaled ×2.286) ────────────
const W = 64, H = 64, R = 14
const LINES = [
  { y: 21, x1: 18, x2: 46 },
  { y: 30, x1: 18, x2: 46 },
  { y: 39, x1: 18, x2: 37 },
]
const HALF = 2

function inRoundedRect(x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return false
  if (x < R    && y < R    && (x-R)**2     + (y-R)**2     > R*R) return false
  if (x >= W-R && y < R    && (x-(W-R-1))**2 + (y-R)**2   > R*R) return false
  if (x < R    && y >= H-R && (x-R)**2     + (y-(H-R-1))**2 > R*R) return false
  if (x >= W-R && y >= H-R && (x-(W-R-1))**2 + (y-(H-R-1))**2 > R*R) return false
  return true
}

function onLine(x, y) {
  for (const ln of LINES) {
    if (y < ln.y - HALF || y > ln.y + HALF) continue
    if (x >= ln.x1 && x <= ln.x2) return true
    if (x < ln.x1  && (x-ln.x1)**2 + (y-ln.y)**2 <= (HALF+0.5)**2) return true
    if (x > ln.x2  && (x-ln.x2)**2 + (y-ln.y)**2 <= (HALF+0.5)**2) return true
  }
  return false
}

function renderIcon(bgR, bgG, bgB, lineR, lineG, lineB) {
  const pixels = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (!inRoundedRect(x, y)) {
        pixels[i+3] = 0
      } else if (onLine(x, y)) {
        pixels[i] = lineR; pixels[i+1] = lineG; pixels[i+2] = lineB; pixels[i+3] = 255
      } else {
        pixels[i] = bgR; pixels[i+1] = bgG; pixels[i+2] = bgB; pixels[i+3] = 255
      }
    }
  }
  return makePng(pixels, W, H)
}

// ── Write files ────────────────────────────────────────────────────────────────
const dir = path.join(__dirname, 'resources')
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const lightIcon = renderIcon(99, 102, 241, 255, 255, 255)
const darkIcon  = renderIcon(255, 255, 255, 99, 102, 241)

fs.writeFileSync(path.join(dir, 'icon-light.png'), lightIcon)
fs.writeFileSync(path.join(dir, 'icon-dark.png'),  darkIcon)
fs.writeFileSync(path.join(dir, 'icon.png'),        lightIcon)

console.log('resources/icon-light.png  — indigo bg + white lines  (light desktop)')
console.log('resources/icon-dark.png   — white  bg + indigo lines (dark  desktop)')
console.log('resources/icon.png        — default fallback (= icon-light.png)')
