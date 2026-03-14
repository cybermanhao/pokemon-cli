/**
 * Game state store
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createBattlePokemon, getSpecies, getStartingMoves, BATTLE_GEN } from '@pokemon/battle';

const SAVE_DIR = join(homedir(), '.pokemon-cli');
const SAVE_FILE = join(SAVE_DIR, 'save.json');

const DEFAULT_STATE = {
  started: false, lang: 'zh', playerName: '玩家', money: 3000, badges: 0, steps: 0,
  team: [], pcBox: [],
  items: [{ id: 'pokeball', count: 5 }, { id: 'potion', count: 3 }],
  mapX: 5, mapY: 5, mapSeed: Math.floor(Math.random() * 0xffff),
};

let _state = { ...DEFAULT_STATE };
const _listeners = new Set();

function notify() { for (const fn of _listeners) fn(_state); }

export const store = {
  getState() { return _state; },
  setState(patch) { _state = { ..._state, ...patch }; notify(); },
  subscribe(fn) { _listeners.add(fn); return () => _listeners.delete(fn); },
  hasSave() { return existsSync(SAVE_FILE); },
  load() {
    if (!existsSync(SAVE_FILE)) return false;
    try { _state = { ...DEFAULT_STATE, ...JSON.parse(readFileSync(SAVE_FILE, 'utf8')) }; notify(); return true; } catch { return false; }
  },
  save() { mkdirSync(SAVE_DIR, { recursive: true }); writeFileSync(SAVE_FILE, JSON.stringify(_state, null, 2)); },
};

export async function createPokemonInstance(sourceData, level = 5) {
  if (sourceData.baseStats) {
    const moveIds = await getStartingMoves(sourceData.id, level, BATTLE_GEN);
    return createBattlePokemon(sourceData, level, moveIds, BATTLE_GEN);
  }
  const speciesLike = {
    id: (sourceData.nameEn || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, ''),
    name: sourceData.nameEn || sourceData.name,
    nameZh: sourceData.nameZh || sourceData.nameEn,
    nameJa: sourceData.nameJa || sourceData.nameEn,
    type1: sourceData.type || 'normal',
    type2: sourceData.type2 || null,
    num: sourceData.id || 0,
    baseStats: { hp: sourceData.hp || 50, atk: sourceData.attack || 50, def: sourceData.defense || 50, spa: sourceData.specialAttack || 50, spd: sourceData.specialDefense || 50, spe: sourceData.speed || 50 },
  };
  let moveIds;
  const dexSpecies = getSpecies(speciesLike.name, BATTLE_GEN);
  if (dexSpecies) moveIds = await getStartingMoves(dexSpecies.id, level, BATTLE_GEN);
  else if (sourceData.moves?.length) moveIds = sourceData.moves.slice(0, 4).map(m => m.id || m.nameEn?.toLowerCase() || 'tackle');
  else moveIds = ['tackle'];
  const instance = createBattlePokemon(speciesLike, level, moveIds, BATTLE_GEN);
  instance.nameZh = sourceData.nameZh || instance.nameEn;
  instance.nameJa = sourceData.nameJa || instance.nameEn;
  return instance;
}
