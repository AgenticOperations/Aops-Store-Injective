/** IEEE CRC32 — used for client-side typo detection on credential tokens (`04` §8.1). */
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

export function crc32(input: string): string {
  let crc = 0xffffffff
  for (let i = 0; i < input.length; i++) {
    const index = (crc ^ input.charCodeAt(i)) & 0xff
    crc = (CRC32_TABLE[index] ?? 0) ^ (crc >>> 8)
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}
