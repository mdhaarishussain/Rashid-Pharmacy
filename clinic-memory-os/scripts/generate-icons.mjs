// Generates minimal 192x192 and 512x512 PNG icons for PWA
// Uses only Node.js built-ins — no external dependencies needed

import { createWriteStream } from 'fs'
import { deflateSync } from 'zlib'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public')

function uint32BE(n) {
  const buf = Buffer.alloc(4)
  buf.writeUInt32BE(n, 0)
  return buf
}

function crc32(data) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = uint32BE(data.length)
  const crcData = Buffer.concat([typeBytes, data])
  const crcBuf = uint32BE(crc32(crcData))
  return Buffer.concat([len, crcBuf.slice(0, 0), typeBytes, data, crcBuf])
}

// PNG chunk with proper CRC
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeBytes, data])
  const crcVal = crc32(Array.from(crcData))
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crcVal)])
}

function generatePNG(size, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR: width, height, bit depth=8, color type=2 (RGB), compression=0, filter=0, interlace=0
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  // Build raw pixel data
  // Each row: filter byte (0) + size*3 bytes RGB
  const rawRow = Buffer.alloc(1 + size * 3)
  rawRow[0] = 0 // filter type None
  for (let col = 0; col < size; col++) {
    rawRow[1 + col * 3] = r
    rawRow[1 + col * 3 + 1] = g
    rawRow[1 + col * 3 + 2] = b
  }
  // Draw a simple pill/circle icon on it
  const pixels = buildIconPixels(size)
  const rawData = Buffer.alloc(size * (1 + size * 3))
  for (let row = 0; row < size; row++) {
    rawData[row * (1 + size * 3)] = 0 // filter
    for (let col = 0; col < size; col++) {
      const pixelIdx = row * size + col
      const [pr, pg, pb] = pixels[pixelIdx]
      const offset = row * (1 + size * 3) + 1 + col * 3
      rawData[offset] = pr
      rawData[offset + 1] = pg
      rawData[offset + 2] = pb
    }
  }

  const compressed = deflateSync(rawData, { level: 6 })

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function buildIconPixels(size) {
  // Background: #0f172a (dark blue)
  const bg = [15, 23, 42]
  // Circle: #38bdf8 (sky blue)
  const fg = [56, 189, 248]
  // Inner icon: white pill cross
  const white = [255, 255, 255]

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.42

  const pixels = new Array(size * size)

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const dx = col - cx
      const dy = row - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist <= r) {
        // Inside circle — draw a simple "+" cross icon
        const crossW = size * 0.12
        const crossLen = size * 0.28
        if (
          (Math.abs(dx) <= crossW && Math.abs(dy) <= crossLen) ||
          (Math.abs(dy) <= crossW && Math.abs(dx) <= crossLen)
        ) {
          pixels[row * size + col] = white
        } else {
          pixels[row * size + col] = fg
        }
      } else {
        pixels[row * size + col] = bg
      }
    }
  }
  return pixels
}

// Write both icon sizes
import { writeFileSync } from 'fs'

writeFileSync(join(OUT, 'icon-192.png'), generatePNG(192, 56, 189, 248))
writeFileSync(join(OUT, 'icon-512.png'), generatePNG(512, 56, 189, 248))
console.log('Icons generated: icon-192.png, icon-512.png')
