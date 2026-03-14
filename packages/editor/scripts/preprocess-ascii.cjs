/**
 * Pre-process ASCII art for all cached sprites
 * Usage: node scripts/preprocess-ascii.js [width] [charset]
 */

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const CACHE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.pokemon-cli', 'sprites', 'png');
const OUTPUT_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.pokemon-cli', 'sprites', 'ascii');

const WIDTH = parseInt(process.argv[2]) || 32;
const CHARSET = process.argv[3] || 'dense';

const CHARSETS = {
  dense: ' .:-=+*#%@',
  simple: ' .+*#@',
  blocks: ' ░▒▓█',
};

function getChars(cs) {
  return CHARSETS[cs] || CHARSETS.dense;
}

function applyContrast(brightness, contrast) {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  return Math.max(0, Math.min(255, factor * (brightness - 128) + 128));
}

async function renderAscii(imagePath, width, charset, invert = false, contrast = 0) {
  const img = await Jimp.read(imagePath);
  const origW = img.bitmap.width;
  const origH = img.bitmap.height;

  // Aspect ratio correction: terminal cells are 2:1
  const height = Math.max(1, Math.round(width * (origH / origW) * 0.5));

  const resized = img.clone().resize(width, height);
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

  return lines;
}

async function main() {
  console.log(`Looking for sprites in: ${CACHE_DIR}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Width: ${WIDTH}, Charset: ${CHARSET}`);

  if (!fs.existsSync(CACHE_DIR)) {
    console.error('Cache directory does not exist. Run download-sprites.js first.');
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${files.length} sprite files`);

  let processed = 0;
  let skipped = 0;

  for (const file of files) {
    const baseName = file.replace('.png', '');
    const outputFile = `${baseName}_w${WIDTH}_${CHARSET}.ascii`;
    const outputPath = path.join(OUTPUT_DIR, outputFile);

    if (fs.existsSync(outputPath)) {
      skipped++;
      continue;
    }

    try {
      const imagePath = path.join(CACHE_DIR, file);
      const ascii = await renderAscii(imagePath, WIDTH, CHARSET);
      fs.writeFileSync(outputPath, ascii.join('\n'));
      processed++;
      if (processed % 50 === 0) {
        console.log(`Processed ${processed}...`);
      }
    } catch (err) {
      console.error(`Error processing ${file}: ${err.message}`);
    }
  }

  console.log(`\nDone! Processed: ${processed}, Skipped: ${skipped}`);
}

main().catch(console.error);
