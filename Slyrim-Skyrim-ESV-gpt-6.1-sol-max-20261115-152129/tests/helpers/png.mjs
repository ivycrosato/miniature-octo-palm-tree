// A small PNG reader for the tests: Playwright's screenshots (8-bit RGB or RGBA, not interlaced) to { w, h, px (RGBA) },
// and colour statistics over a rectangle. No packages: zlib from Node.
import { inflateSync } from 'node:zlib';

export function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let o = 8, w = 0, h = 0, type = 0, depth = 0; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), kind = buf.toString('latin1', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; if (data[12]) throw new Error('interlaced PNG'); }
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || (type !== 2 && type !== 6)) throw new Error('PNG type ' + type + ' depth ' + depth);
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat)), px = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { const s = x * bpp, d = (y * w + x) * 4; px[d] = cur[s]; px[d + 1] = cur[s + 1]; px[d + 2] = cur[s + 2]; px[d + 3] = bpp === 4 ? cur[s + 3] : 255; }
    [prev, cur] = [cur, prev];
  }
  return { w, h, px };
}
/** mean colour and the share of near-black pixels (every channel under `dark`) in [x0, y0, x1, y1) */
export function stats(img, [x0, y0, x1, y1], dark = 24) {
  let n = 0, r = 0, g = 0, b = 0, black = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * img.w + x) * 4; r += img.px[i]; g += img.px[i + 1]; b += img.px[i + 2]; if (Math.max(img.px[i], img.px[i + 1], img.px[i + 2]) < dark) black++; n++; }
  return { r: r / n, g: g / n, b: b / n, black: black / n };
}
