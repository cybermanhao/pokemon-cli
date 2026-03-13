/**
 * Data layer — wraps @pkmn/dex + @pkmn/data.
 * Uses offline game data (no API calls needed).
 */

import { Dex as PkmnDex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';

const gens = new Generations(PkmnDex);

export function getGen(num = 1) { return gens.get(num); }
export function getDex(num = 1) { return PkmnDex.forGen(num); }

export function getSpecies(nameOrId, genNum = 1) {
  const key = nameOrId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s = PkmnDex.forGen(genNum).species.get(nameOrId);
  if (!s || !s.exists) return null;
  return {
    id: s.id, name: s.name, nameZh: s.name, nameJa: s.name,
    type1: s.types[0]?.toLowerCase() ?? 'normal',
    type2: s.types[1]?.toLowerCase() ?? null,
    baseStats: s.baseStats, num: s.num, _raw: s,
  };
}

export function getMove(nameOrId, genNum = 1) {
  const m = PkmnDex.forGen(genNum).moves.get(nameOrId);
  if (!m || !m.exists) return null;
  return {
    id: m.id, name: m.name, nameZh: m.name, nameJa: m.name,
    type: m.type.toLowerCase(), category: m.category,
    basePower: m.basePower, accuracy: m.accuracy,
    pp: m.pp, priority: m.priority ?? 0, secondaryEffect: m.secondary ?? null,
  };
}

export function getEffectiveness(moveType, defType1, defType2 = null, genNum = 1) {
  const gen = getGen(genNum);
  const t = gen.types.get(moveType);
  if (!t) return 1;
  let eff = t.effectiveness[defType1] ?? 1;
  if (defType2) eff *= t.effectiveness[defType2] ?? 1;
  return eff;
}

export function getStartingMoves(speciesId, level = 5, genNum = 1) {
  const dex = PkmnDex.forGen(genNum);
  const levelMoves = dex.species.get(speciesId)?.learnset;
  if (!levelMoves) return ['tackle'];
  const learned = [];
  for (const [moveId, sources] of Object.entries(levelMoves)) {
    for (const src of sources) {
      const match = src.match(/^1L(\d+)/);
      if (match && parseInt(match[1]) <= level) {
        learned.push({ moveId, learnLevel: parseInt(match[1]) });
      }
    }
  }
  learned.sort((a, b) => b.learnLevel - a.learnLevel);
  return [...new Set(learned.map(x => x.moveId))].slice(0, 4);
}
