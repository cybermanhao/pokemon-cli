/**
 * Battle AI
 */

import { calculateDamage, checkAccuracy, goesFirst, applySecondaryEffect } from './engine.js';

export function wildChooseMove(mon) {
  const available = mon.moves.filter(m => m.ppLeft > 0);
  if (available.length === 0) return STRUGGLE;
  return available[Math.floor(Math.random() * available.length)];
}

const STRUGGLE = {
  id: 'struggle', name: 'Struggle', nameZh: '挣扎', nameJa: 'わるあがき',
  type: 'normal', category: 'Physical', basePower: 50,
  accuracy: true, pp: 1, ppLeft: 1, priority: 0, secondary: null,
};

export function executeTurn(player, playerMove, enemy, enemyMove) {
  const events = [];
  const order = goesFirst(player, playerMove, enemy, enemyMove)
    ? [[player, playerMove, enemy], [enemy, enemyMove, player]]
    : [[enemy, enemyMove, player], [player, playerMove, enemy]];

  for (const [attacker, move, defender] of order) {
    if (attacker.hp <= 0 || defender.hp <= 0) break;

    // Status effects
    if (attacker.status === 'paralyze' && Math.random() < 0.25) {
      events.push({ type: 'fullParalyze', pokemon: attacker.uid });
      continue;
    }
    if (attacker.status === 'sleep') {
      attacker.statusTurns++;
      if (attacker.statusTurns < 2 + Math.floor(Math.random() * 5)) {
        events.push({ type: 'sleeping', pokemon: attacker.uid });
        continue;
      }
      attacker.status = null;
      attacker.statusTurns = 0;
      events.push({ type: 'wakeUp', pokemon: attacker.uid });
    }
    if (attacker.status === 'freeze') {
      if (Math.random() >= 0.2) {
        events.push({ type: 'frozen', pokemon: attacker.uid });
        continue;
      }
      attacker.status = null;
      events.push({ type: 'thaw', pokemon: attacker.uid });
    }

    // Accuracy check
    if (!checkAccuracy(attacker, move)) {
      events.push({ type: 'miss', attacker: attacker.uid, move: move.id });
      continue;
    }

    // Use PP
    const moveInSlot = attacker.moves.find(m => m.id === move.id);
    if (moveInSlot) moveInSlot.ppLeft = Math.max(0, moveInSlot.ppLeft - 1);

    // Damage
    const { damage, effectiveness, critical } = calculateDamage(attacker, move, defender);
    if (damage > 0) {
      defender.hp = Math.max(0, defender.hp - damage);
      events.push({ type: 'damage', attacker: attacker.uid, defender: defender.uid, move: move.id, damage, effectiveness, critical });

      const secResult = applySecondaryEffect(move, defender);
      if (secResult) events.push({ type: 'secondary', ...secResult, pokemon: defender.uid });
    } else if (move.category === 'Status') {
      events.push({ type: 'statusMove', attacker: attacker.uid, move: move.id });
    } else {
      events.push({ type: 'noEffect', attacker: attacker.uid, defender: defender.uid });
    }

    if (defender.hp <= 0) {
      events.push({ type: 'faint', pokemon: defender.uid });
      break;
    }
  }

  // End of turn: burn/poison damage
  for (const mon of [player, enemy]) {
    if (mon.hp <= 0) continue;
    if (mon.status === 'burn' || mon.status === 'poison') {
      const dot = Math.max(1, Math.floor(mon.hpMax / 16));
      mon.hp = Math.max(0, mon.hp - dot);
      events.push({ type: 'dot', status: mon.status, pokemon: mon.uid, damage: dot });
      if (mon.hp <= 0) events.push({ type: 'faint', pokemon: mon.uid });
    }
  }

  return events;
}
