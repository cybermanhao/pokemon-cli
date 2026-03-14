/**
 * Data layer — wraps @pkmn/dex + @pkmn/data.
 * Uses offline game data (no API calls needed).
 */

import { Dex as PkmnDex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';
import { MOD_ID, MOD_DATA } from './mod.js';

// 当前战斗世代 — 修改此处即可全局切换
export const BATTLE_GEN = 9;

// 应用自定义 mod，所有数据修改在 mod.js 中集中定义
const modDex = PkmnDex.mod(MOD_ID, MOD_DATA);
const gens = new Generations(modDex);

export function getGen(num = BATTLE_GEN) { return gens.get(num); }
export function getDex(num = BATTLE_GEN) { return modDex.forGen(num); }

export function getSpecies(nameOrId, genNum = BATTLE_GEN) {
  const s = getDex(genNum).species.get(nameOrId);
  if (!s || !s.exists) return null;
  return {
    id: s.id, name: s.name, nameZh: s.name, nameJa: s.name,
    type1: s.types[0]?.toLowerCase() ?? 'normal',
    type2: s.types[1]?.toLowerCase() ?? null,
    baseStats: s.baseStats, num: s.num, _raw: s,
  };
}

export function getMove(nameOrId, genNum = BATTLE_GEN) {
  const m = getDex(genNum).moves.get(nameOrId);
  if (!m || !m.exists) return null;
  return {
    id: m.id, name: m.name, nameZh: m.name, nameJa: m.name,
    type: m.type.toLowerCase(), category: m.category,
    basePower: m.basePower, accuracy: m.accuracy,
    pp: m.pp, priority: m.priority ?? 0, secondaryEffect: m.secondary ?? null,
  };
}

export function getEffectiveness(moveType, defType1, defType2 = null, genNum = BATTLE_GEN) {
  const gen = getGen(genNum);
  const t = gen.types.get(moveType);
  if (!t) return 1;
  let eff = t.effectiveness[defType1] ?? 1;
  if (defType2) eff *= t.effectiveness[defType2] ?? 1;
  return eff;
}

// 返回 Promise — learnsets.get() 是异步的
export async function getStartingMoves(speciesId, level = 5, genNum = BATTLE_GEN) {
  const gen = getGen(genNum);
  const lsData = await gen.learnsets.get(speciesId);
  if (!lsData?.learnset) return ['tackle'];

  const learned = [];
  const learnPattern = new RegExp(`^${genNum}L(\\d+)`);

  for (const [moveId, sources] of Object.entries(lsData.learnset)) {
    // sources 是逗号分隔字符串，如 "9M,9L24,8M,8L24"
    for (const src of sources) {
      const match = src.match(learnPattern);
      if (match && parseInt(match[1]) <= level) {
        learned.push({ moveId, learnLevel: parseInt(match[1]) });
      }
    }
  }

  // 当前世代无升级技能数据时，降级查找任意世代（如 Gen1 Pokemon 在 Gen9 可能无数据）
  if (learned.length === 0) {
    for (const [moveId, sources] of Object.entries(lsData.learnset)) {
      for (const src of sources) {
        const match = src.match(/^(\d+)L(\d+)/);
        if (match && parseInt(match[2]) <= level) {
          learned.push({ moveId, learnLevel: parseInt(match[2]) });
        }
      }
    }
  }

  if (learned.length === 0) return ['tackle'];
  learned.sort((a, b) => b.learnLevel - a.learnLevel);
  return [...new Set(learned.map(x => x.moveId))].slice(0, 4);
}
