import { invoke } from '@tauri-apps/api/core';

/**
 * @typedef {Object} ModData
 * @property {import('serde_json').Value} species
 * @property {import('serde_json').Value} moves
 * @property {string} items_raw
 */

/**
 * Read mod data from the mod.js file
 * @param {string} modPath - Absolute path to mod.js
 * @returns {Promise<ModData>}
 */
export async function readModData(modPath) {
  return invoke('read_mod_data', { modPath });
}

/**
 * Write mod data to the mod.js file
 * @param {string} modPath - Absolute path to mod.js
 * @param {import('serde_json').Value} species
 * @param {import('serde_json').Value} moves
 * @param {string} itemsRaw
 * @returns {Promise<void>}
 */
export async function writeModData(modPath, species, moves, itemsRaw) {
  return invoke('write_mod_data', { modPath, species, moves, itemsRaw });
}

/**
 * Fetch sprite PNG from PokéAPI
 * @param {string} speciesId - Species ID (e.g., '25' for Pikachu)
 * @param {string} variant - 'front' or 'back'
 * @param {boolean} shiny - Whether to fetch shiny variant
 * @returns {Promise<string>} - Path to saved PNG file
 */
export async function fetchSpritePng(speciesId, variant = 'front', shiny = false) {
  return invoke('fetch_sprite_png', { speciesId, variant, shiny });
}

/**
 * Render ASCII from PNG using native Rust engine
 * @param {string} pngPath - Path to PNG file
 * @param {Object} config - ASCII render config
 * @returns {Promise<string[]>}
 */
export async function renderAsciiNative(pngPath, config) {
  return invoke('render_ascii_native', { pngPath, config });
}

/**
 * Render ASCII from PNG using sidecar engine
 * @param {'jimp' | 'chafa' | 'jp2a'} engine - Sidecar engine
 * @param {string} pngPath - Path to PNG file
 * @param {number} width - Target width in characters
 * @param {string} charset - Character set name
 * @param {boolean} colored - Enable ANSI colors
 * @param {boolean} invert - Invert brightness
 * @param {number} contrast - Contrast adjustment
 * @returns {Promise<string>}
 */
export async function renderAsciiSidecar(engine, pngPath, width, charset, colored, invert, contrast) {
  return invoke('render_ascii_sidecar', {
    engine,
    pngPath,
    width,
    charset,
    colored,
    invert,
    contrast,
  });
}
