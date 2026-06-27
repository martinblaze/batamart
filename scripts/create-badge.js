// scripts/create-badge.js
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const WIDTH = 72
const HEIGHT = 72
const outputPath = path.join(__dirname, '../public/badge-72x72.png')

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      t[i] = c >>> 0
    }
    return t
  })())

  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const chunk = Buffer.alloc(8 + data.length + 4)
  chunk.writeUInt32BE(data.length, 0)
  typeBuf.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length)
  return chunk
}

const rawData = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT)
for (let y = 0; y < HEIGHT; y++) {
  const rowStart = y * (WIDTH * 4 + 1)
  rawData[rowStart] = 0
}

function fillRect(x, y, w, h, r, g, b, a) {
  for (let yy = y; yy < y + h; yy++) {
    const rowStart = yy * (WIDTH * 4 + 1) + 1
    for (let xx = x; xx < x + w; xx++) {
      const idx = rowStart + xx * 4
      rawData[idx] = r
      rawData[idx + 1] = g
      rawData[idx + 2] = b
      rawData[idx + 3] = a
    }
  }
}

// transparent background
fillRect(0, 0, WIDTH, HEIGHT, 0, 0, 0, 0)

// Draw a bold B shape in white
fillRect(14, 12, 10, 48, 255, 255, 255, 255)
fillRect(24, 12, 24, 12, 255, 255, 255, 255)
fillRect(24, 30, 24, 12, 255, 255, 255, 255)
fillRect(24, 48, 24, 12, 255, 255, 255, 255)
fillRect(34, 18, 8, 6, 0, 0, 0, 0)
fillRect(34, 36, 8, 6, 0, 0, 0, 0)
fillRect(34, 54, 8, 6, 0, 0, 0, 0)

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdrData = Buffer.alloc(13)
ihdrData.writeUInt32BE(WIDTH, 0)
ihdrData.writeUInt32BE(HEIGHT, 4)
ihdrData.writeUInt8(8, 8)
ihdrData.writeUInt8(6, 9)
ihdrData.writeUInt8(0, 10)
ihdrData.writeUInt8(0, 11)
ihdrData.writeUInt8(0, 12)

const idatData = zlib.deflateSync(rawData)
const pngBuffer = Buffer.concat([
  pngSignature,
  pngChunk('IHDR', ihdrData),
  pngChunk('IDAT', idatData),
  pngChunk('IEND', Buffer.alloc(0)),
])

fs.writeFileSync(outputPath, pngBuffer)
console.log('✅ badge-72x72.png created in /public/')
