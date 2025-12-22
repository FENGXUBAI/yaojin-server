// 生成微信小程序用到的 PNG 图标（纯 JS，无需原生依赖）
// 用法：node scripts/generate_icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPngRgba(width, height, pixelFn) {
  // Raw scanlines: each row starts with filter byte 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[(width * 4 + 1) * y] = 0;
    for (let x = 0; x < width; x++) {
      const idx = (width * 4 + 1) * y + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y);
      raw[idx + 0] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idatData = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function writeIcon(filePath, size, bg1, bg2, fg) {
  const [r1, g1, b1] = hexToRgb(bg1);
  const [r2, g2, b2] = hexToRgb(bg2);
  const [rf, gf, bf] = hexToRgb(fg);

  const png = createPngRgba(size, size, (x, y) => {
    // 背景：竖向渐变
    const t = y / (size - 1);
    const r = Math.round(lerp(r1, r2, t));
    const g = Math.round(lerp(g1, g2, t));
    const b = Math.round(lerp(b1, b2, t));

    // 前景：一个圆角方块 + 一个高亮圆点
    const pad = Math.floor(size * 0.22);
    const inner = size - pad * 2;
    const ix = x - pad;
    const iy = y - pad;
    const radius = Math.floor(size * 0.12);

    let inRoundRect = false;
    if (ix >= 0 && iy >= 0 && ix < inner && iy < inner) {
      // 圆角判定
      const cx = ix < radius ? radius : ix >= inner - radius ? inner - radius - 1 : ix;
      const cy = iy < radius ? radius : iy >= inner - radius ? inner - radius - 1 : iy;
      const dx = ix - cx;
      const dy = iy - cy;
      inRoundRect = dx * dx + dy * dy <= radius * radius;
    }

    // 高亮点
    const dotX = Math.floor(size * 0.70);
    const dotY = Math.floor(size * 0.32);
    const dotR = Math.floor(size * 0.06);
    const ddx = x - dotX;
    const ddy = y - dotY;
    const inDot = ddx * ddx + ddy * ddy <= dotR * dotR;

    // 合成
    let outR = r;
    let outG = g;
    let outB = b;

    if (inRoundRect) {
      // 叠加前景（半透明）
      const alpha = 0.65;
      outR = Math.round(lerp(outR, rf, alpha));
      outG = Math.round(lerp(outG, gf, alpha));
      outB = Math.round(lerp(outB, bf, alpha));
    }

    if (inDot) {
      outR = 255;
      outG = 215;
      outB = 0;
    }

    return [outR, outG, outB, 255];
  });

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, png);
}

function main() {
  const root = path.resolve(__dirname, '..', 'images');

  // Logo + WeChat
  writeIcon(path.join(root, 'logo.png'), 256, '#1a1a2e', '#0f3460', '#ffffff');
  writeIcon(path.join(root, 'wechat-icon.png'), 128, '#07c160', '#0aa35a', '#ffffff');

  // Tab icons (灰/绿)
  writeIcon(path.join(root, 'tab-lobby.png'), 96, '#eeeeee', '#dddddd', '#666666');
  writeIcon(path.join(root, 'tab-lobby-active.png'), 96, '#2d5016', '#3b6b1e', '#ffffff');

  writeIcon(path.join(root, 'tab-rank.png'), 96, '#eeeeee', '#dddddd', '#666666');
  writeIcon(path.join(root, 'tab-rank-active.png'), 96, '#2d5016', '#3b6b1e', '#ffffff');

  writeIcon(path.join(root, 'tab-profile.png'), 96, '#eeeeee', '#dddddd', '#666666');
  writeIcon(path.join(root, 'tab-profile-active.png'), 96, '#2d5016', '#3b6b1e', '#ffffff');

  console.log('Icons generated in:', root);
}

main();
