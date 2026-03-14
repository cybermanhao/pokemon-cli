const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.pokemon-cli', 'sprites', 'png');

const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.png'));
console.log('Total files:', files.length);

async function test() {
  const imgPath = path.join(CACHE_DIR, files[0]);
  console.log('Testing:', files[0]);

  try {
    const img = await Jimp.read(imgPath);
    console.log('Original:', img.bitmap.width, 'x', img.bitmap.height);

    // Try different resize syntax
    img.resize({ w: 32, h: 32 });
    console.log('Resize with object ok');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
