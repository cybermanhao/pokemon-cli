import { Jimp } from 'jimp';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CACHE_DIR = join(homedir(), '.pokemon-cli', 'sprites');
const ASCII_DENSE = ' .:-=+*#%@';

function rgbToAnsi256(r, g, b) {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }
  const ri = Math.round(r / 255 * 5);
  const gi = Math.round(g / 255 * 5);
  const bi = Math.round(b / 255 * 5);
  return 16 + 36 * ri + 6 * gi + bi;
}

function ansi256(code, text) { return `\x1b[38;5;${code}m${text}\x1b[0m`; }

async function jimpToAscii(img, opts = {}) {
  const { width = 32, height = 16, colored = true, chars = ASCII_DENSE } = opts;
  const resized = img.clone().resize({ w: width, h: height });
  const lines = [];
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const pixel = resized.getPixelColor(x, y);
      const r = (pixel >>> 24) & 0xff, g = (pixel >>> 16) & 0xff, b = (pixel >>> 8) & 0xff, a = pixel & 0xff;
      if (a < 64) { line += ' '; continue; }
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const charIdx = Math.floor((brightness / 255) * (chars.length - 1));
      const ch = chars[charIdx];
      line += colored && a >= 64 ? ansi256(rgbToAnsi256(r, g, b), ch) : ch;
    }
    lines.push(line);
  }
  return lines;
}

function ensureCache() { if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true }); }
function cachePath(id, v) { return join(CACHE_DIR, `${id}_${v}.json`); }
function loadCache(id, v) { const p = cachePath(id, v); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; }
function saveCache(id, v, lines) { ensureCache(); writeFileSync(cachePath(id, v), JSON.stringify(lines)); }

async function fetchSpriteUrls(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`PokeAPI error: ${res.status}`);
  const data = await res.json();
  return { front: data.sprites.front_default, back: data.sprites.back_default, frontShiny: data.sprites.front_shiny };
}

async function fetchImageBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function getPokemonAscii(pokemonId, opts = {}) {
  const { variant = 'front', colored = true, width = 32, height = 16 } = opts;
  const cacheKey = colored ? variant : `${variant}_mono`;
  const cached = loadCache(pokemonId, cacheKey);
  if (cached) return cached;
  const urls = await fetchSpriteUrls(pokemonId);
  const url = urls[variant] || urls.front;
  if (!url) return getFallbackSprite(pokemonId);
  const buf = await fetchImageBuffer(url);
  const img = await Jimp.fromBuffer(buf);
  const lines = jimpToAscii(img, { width, height, colored, chars: ASCII_DENSE });
  saveCache(pokemonId, cacheKey, lines);
  return lines;
}

export function getFallbackSprite(id) {
  return [`  .-------.  `, ` /  ? ? ?  \\ `, `|  (?) (?)  |`, `|    ---    |`, ` \\  _____  / `, `  \`--${String(id).padStart(3,'0')}--\`  `];
}
