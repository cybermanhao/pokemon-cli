/**
 * Batch download Pokemon sprites from PokéAPI
 * Usage: node scripts/download-sprites.js [startId] [endId]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const CACHE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.pokemon-cli', 'sprites', 'png');

// Variants to download
const VARIANTS = ['front', 'back', 'frontShiny', 'backShiny'];

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 404) {
        file.close();
        fs.unlinkSync(dest);
        resolve(null);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function downloadVariant(id, variant) {
  // front is at root, other variants are in subdirectories
  const url = variant === 'front'
    ? `${BASE_URL}/${id}.png`
    : `${BASE_URL}/${variant}/${id}.png`;
  const filename = `${id}_${variant}.png`;
  const dest = path.join(CACHE_DIR, filename);

  if (fs.existsSync(dest)) {
    console.log(`  Skip ${filename} (already exists)`);
    return;
  }

  try {
    await download(url, dest);
    console.log(`  Downloaded ${filename}`);
  } catch (err) {
    console.error(`  Error downloading ${filename}: ${err.message}`);
  }
}

async function main() {
  const startId = parseInt(process.argv[2]) || 1;
  const endId = parseInt(process.argv[3]) || 1025;

  console.log(`Downloading Pokemon sprites ${startId} to ${endId}...`);
  console.log(`Cache directory: ${CACHE_DIR}`);

  let success = 0;
  let skipped = 0;

  for (let id = startId; id <= endId; id++) {
    process.stdout.write(`[${id}/${endId}] `);

    for (const variant of VARIANTS) {
      const filename = `${id}_${variant}.png`;
      const dest = path.join(CACHE_DIR, filename);

      if (fs.existsSync(dest)) {
        skipped++;
        continue;
      }

      // front is at root, other variants are in subdirectories
      const url = variant === 'front'
        ? `${BASE_URL}/${id}.png`
        : `${BASE_URL}/${variant}/${id}.png`;
      try {
        await download(url, dest);
        success++;
      } catch (err) {
        // 404 is ok, just means this variant doesn't exist
      }
    }
    console.log('');
  }

  console.log(`\nDone! Downloaded: ${success}, Skipped: ${skipped}`);
}

main().catch(console.error);
