'use strict';

const [, , engine, pngPath, ...args] = process.argv;

if (!pngPath) {
  process.stderr.write('Usage: node-sprite.cjs <engine> <png_path> [options]\n');
  process.exit(1);
}

const width = parseInt(args[0]) || 32;
const charset = args[1] || 'dense';
const colored = args[2] === 'true';
const invert = args[3] === 'true';
const contrast = parseFloat(args[4]) || 0;

const CHARSETS = {
  dense: ' .:-=+*#%@',
  simple: ' .+*#@',
  blocks: ' \u2591\u2592\u2593\u2588',
};

function getChars(cs) {
  return CHARSETS[cs] ?? cs;
}

function applyContrast(brightness, contrast) {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  return Math.max(0, Math.min(255, factor * (brightness - 128) + 128)));
}

async function main() {
  const { Jimp } = require('jimp');
  const img = await Jimp.read(pngPath);
  const origW = img.bitmap.width;
  const origH = img.bitmap.height;

  // Aspect ratio correction: terminal cells are 2:1
  const height = Math.max(1, Math.round(width * (origH / origW) * 0.5));

  const resized = img.resize({ w: width, h: height });
  const chars = getChars(charset);
  const lines = [];

  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const pixel = resized.getPixelColor(x, y);
      const r = (pixel >> 24) & 0xff;
      const g = (pixel >> 16) & 0xff;
      const b = (pixel >> 8) & 0xff;
      const a = pixel & 0xff;

      if (a < 64) {
        line += ' ';
        continue;
      }

      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const adjusted = applyContrast(brightness, contrast);
      const idx = Math.floor(((invert ? adjusted : 255 - adjusted) / 255) * (chars.length - 1));
      const ch = chars[idx] || ' ';

      line += ch;
    }
    lines.push(line);
  }

  process.stdout.write(JSON.stringify(lines));
}

main().catch((err) => {
  process.stderr.write(err.message + '\n');
  process.exit(1);
});
