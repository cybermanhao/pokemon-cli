import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';

const gen = new Generations()[9];

/** @type {string[]} */
export const TYPES = [
  'Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel',
  'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy',
];

/** @type {string[]} */
export const ABILITIES = gen.abilities.map((a) => a.name);

/**
 * Get all species names
 * @returns {string[]}
 */
export function getAllSpeciesNames() {
  return gen.species.map((s) => s.name);
}

/**
 * Get all ability names
 * @returns {string[]}
 */
export function getAllAbilityNames() {
  return ABILITIES;
}

/**
 * Get official species data by name
 * @param {string} name - Species name
 * @returns {import('@pkmn/data').Species | null}
 */
export function getOfficialSpecies(name) {
  try {
    const species = gen.species.get(name);
    return species || null;
  } catch {
    return null;
  }
}

/**
 * Get types for a species
 * @param {string} name - Species name
 * @returns {{ type1: string, type2: string | null }}
 */
export function getSpeciesTypes(name) {
  const species = getOfficialSpecies(name);
  if (!species) return { type1: 'Normal', type2: null };
  return { type1: species.types[0], type2: species.types[1] || null };
}

/**
 * Get base stats for a species
 * @param {string} name - Species name
 * @returns {{ hp: number, atk: number, def: number, spa: number, spd: number, spe: number } | null}
 */
export function getSpeciesBaseStats(name) {
  const species = getOfficialSpecies(name);
  if (!species) return null;
  return species.baseStats;
}

/**
 * Get abilities for a species
 * @param {string} name - Species name
 * @returns {{ abilities: string[], hiddenAbilities: string[] }}
 */
export function getSpeciesAbilities(name) {
  const species = getOfficialSpecies(name);
  if (!species) return { abilities: [], hiddenAbilities: [] };
  return {
    abilities: species.abilities,
    hiddenAbilities: species.hiddenAbilities || [],
  };
}

/**
 * Get learnset for a species
 * @param {string} name - Species name
 * @returns {{ levelUp: Array<{ move: string, level: number }>, eggMoves: string[], tmMoves: string[] }}
 */
export async function getLearnset(name) {
  const learnsets = await gen.learnsets.get(name);
  if (!learnsets) {
    return { levelUp: [], eggMoves: [], tmMoves: [] };
  }

  const levelUp = [];
  const eggMoves = [];
  const tmMoves = [];

  for (const [move, sources] of Object.entries(learnsets)) {
    for (const source of sources) {
      if (source.startsWith('9L')) {
        levelUp.push({ move, level: parseInt(source.slice(2), 10) });
      } else if (source === '9E') {
        eggMoves.push(move);
      } else if (source === '9M' || source === '9T') {
        tmMoves.push(move);
      }
    }
  }

  levelUp.sort((a, b) => a.level - b.level);

  return { levelUp, eggMoves, tmMoves };
}

export { Dex, gen };
