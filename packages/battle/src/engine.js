/**
 * Battle engine using @smogon/calc for damage.
 */

import { calculate, Generations, Pokemon as CalcPokemon, Move as CalcMove } from '@smogon/calc';
import { getDex, getEffectiveness } from './dex.js';

export function createBattlePokemon(speciesData, level, moveIds, genNum = 1) {
  const { baseStats } = speciesData;
  const calcStat = (base, isHp = false) => {
    if (isHp) return Math.floor((base * 2 * level) / 100) + level + 10;
    return Math.floor((base * 2 * level) / 100) + 5;
  };

  const hpMax = calcStat(baseStats.hp, true);
  const dex = getDex(genNum);

  const moves = moveIds.map(id => {
    const m = dex.moves.get(id);
    return m?.exists ? {
      id: m.id, name: m.name, nameZh: m.name, nameJa: m.name,
      type: m.type.toLowerCase(), category: m.category,
      basePower: m.basePower, accuracy: m.accuracy,
      pp: m.pp, ppLeft: m.pp, priority: m.priority ?? 0, secondary: m.secondary ?? null,
    } : null;
  }).filter(Boolean);

  if (moves.length === 0) {
    moves.push({ id: 'tackle', name: 'Tackle', nameZh: '撞击', nameJa: 'たいあたり',
      type: 'normal', category: 'Physical', basePower: 40, accuracy: 100, pp: 35, ppLeft: 35, priority: 0, secondary: null });
  }

  return {
    uid: `${speciesData.id}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    id: speciesData.num ?? 0, speciesId: speciesData.id,
    nameEn: speciesData.name, nameZh: speciesData.nameZh ?? speciesData.name, nameJa: speciesData.nameJa ?? speciesData.name,
    type: speciesData.type1, type2: speciesData.type2 ?? null,
    level, exp: 0, expToNext: level * level * 10,
    hpMax, hp: hpMax,
    atk: calcStat(baseStats.atk), def: calcStat(baseStats.def),
    spa: calcStat(baseStats.spa), spd: calcStat(baseStats.spd), spe: calcStat(baseStats.spe),
    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
    moves, status: null, statusTurns: 0, genNum,
  };
}

export function calculateDamage(attacker, move, defender) {
  const genNum = attacker.genNum ?? 1;
  if (move.category === 'Status' || move.basePower === 0) {
    return { damage: 0, effectiveness: 1, critical: false, desc: '' };
  }

  try {
    const gen = Generations.get(genNum);
    const calcAttacker = new CalcPokemon(gen, attacker.speciesId || attacker.nameEn, {
      level: attacker.level, boosts: attacker.boosts,
      status: attacker.status === 'burn' ? 'brn' : attacker.status === 'paralyze' ? 'par' : undefined,
    });
    const calcDefender = new CalcPokemon(gen, defender.speciesId || defender.nameEn, {
      level: defender.level, boosts: defender.boosts,
    });
    const calcMove = new CalcMove(gen, move.id || move.name);
    const result = calculate(gen, calcAttacker, calcDefender, calcMove);

    if (Array.isArray(result.damage) && result.damage.length > 0) {
      const rolledDamage = result.damage[Math.floor(Math.random() * result.damage.length)];
      const effectiveness = result.rawDesc.isSuperEffective ? 2 : result.rawDesc.isNotVeryEffective ? 0.5 : 1;
      return { damage: rolledDamage, effectiveness, critical: !!result.rawDesc.isCriticalHit, desc: result.desc() };
    }
  } catch {}

  // Fallback
  const isSpecial = move.category === 'Special';
  const atk = attacker.boosts?.[isSpecial ? 'spa' : 'atk'] ?? 0;
  const def = defender.boosts?.[isSpecial ? 'spd' : 'def'] ?? 0;
  const atkStat = applyBoost(isSpecial ? attacker.spa : attacker.atk, atk);
  const defStat = applyBoost(isSpecial ? defender.spd : defender.def, def);

  const effectiveness = getEffectiveness(move.type, defender.type, defender.type2, genNum);
  if (effectiveness === 0) return { damage: 0, effectiveness: 0, critical: false, desc: 'No effect' };

  const base = Math.floor((Math.floor((2 * attacker.level / 5 + 2) * Math.max(1, atkStat) * move.basePower) / Math.max(1, defStat)) / 50) + 2;
  const stab = (move.type === attacker.type || move.type === attacker.type2) ? 1.5 : 1;
  const burnMod = (attacker.status === 'burn' && move.category === 'Physical') ? 0.5 : 1;
  const rand = (Math.floor(Math.random() * 39) + 217) / 255;

  let dmg = Math.floor(base * stab * burnMod * effectiveness * rand);
  return { damage: Math.max(1, dmg), effectiveness, critical: false, desc: '' };
}

function applyBoost(stat, stage) {
  const STAGE = [2, 2.5, 2.667, 3, 4, 6, 8];
  if (stage >= 0) return Math.floor(stat * STAGE[stage] / STAGE[0]);
  return Math.floor(stat * STAGE[0] / STAGE[-stage]);
}

export function checkAccuracy(attacker, move) {
  if (move.accuracy === true || !move.accuracy) return true;
  const accMod = Math.pow(3, (attacker.boosts?.accuracy ?? 0)) / Math.pow(3, 0);
  return Math.random() * 100 < move.accuracy * accMod;
}

export function applySecondaryEffect(move, target) {
  const sec = move.secondary;
  if (!sec) return null;
  if (Math.random() * 100 >= (sec.chance ?? 100)) return null;
  if (sec.status && !target.status) {
    const MAP = { brn: 'burn', par: 'paralyze', slp: 'sleep', frz: 'freeze', psn: 'poison' };
    target.status = MAP[sec.status] ?? sec.status;
    target.statusTurns = 0;
    return { effect: 'status', status: target.status };
  }
  if (sec.boosts) {
    for (const [stat, val] of Object.entries(sec.boosts)) {
      target.boosts[stat] = Math.max(-6, Math.min(6, (target.boosts[stat] ?? 0) + val));
    }
    return { effect: 'boosts', boosts: sec.boosts };
  }
  return null;
}

export function calcXpGain(defeated, isWild = true) {
  return Math.floor(64 * defeated.level / 7);
}

function applyStat(stage) {
  const table = [2/8, 2/7, 2/6, 2/5, 2/4, 2/3, 2/2, 3/2, 4/2, 5/2, 6/2, 7/2, 8/2];
  return stage >= 0 ? table[stage] : 1 / table[-stage];
}

export function goesFirst(attacker, atkMove, defender, defMove) {
  const atkPrio = atkMove?.priority ?? 0;
  const defPrio = defMove?.priority ?? 0;
  if (atkPrio !== defPrio) return atkPrio > defPrio;

  const atkSpe = (attacker.status === 'paralyze' ? Math.floor(attacker.spe / 4) : attacker.spe) * applyStat(attacker.boosts?.spe ?? 0);
  const defSpe = (defender.status === 'paralyze' ? Math.floor(defender.spe / 4) : defender.spe) * applyStat(defender.boosts?.spe ?? 0);
  if (atkSpe !== defSpe) return atkSpe > defSpe;
  return Math.random() < 0.5;
}
