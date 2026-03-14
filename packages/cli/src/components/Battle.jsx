import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { t, getLanguage } from '@pokemon/i18n';
import PokemonSprite from './PokemonSprite.jsx';
import { executeTurn, wildChooseMove, createBattlePokemon, getSpecies, getStartingMoves, calcXpGain, BATTLE_GEN } from '@pokemon/battle';
import { store } from '../store/gameState.js';
import { animationEngine } from '@pokemon/animation';
import { ANIMATIONS, getAnimationConfig } from './battle/animations.js';
import AnimatedSprite from './battle/AnimatedSprite.jsx';

const WILD_POOL = ['rattata','pidgey','spearow','ekans','sandshrew','nidoran-f','nidoran-m','clefairy','vulpix','jigglypuff','meowth','psyduck','mankey','growlithe','poliwag','abra','machop','bellsprout','tentacool','geodude','ponyta','slowpoke','magnemite','doduo','seel','grimer','shellder','gastly','drowzee','krabby','voltorb','exeggcute','cubone','koffing','rhyhorn','horsea','goldeen','staryu','scyther','pinsir','tauros','magikarp','eevee','omanyte','kabuto','dratini'];

async function generateWildPokemon(playerLevel) {
  const name = WILD_POOL[Math.floor(Math.random() * WILD_POOL.length)];
  const level = Math.max(1, playerLevel + Math.floor(Math.random() * 5) - 2);
  const species = getSpecies(name, BATTLE_GEN);
  if (!species) return null;
  const moves = await getStartingMoves(species.id, level, BATTLE_GEN);
  return createBattlePokemon(species, level, moves, BATTLE_GEN);
}

const HPBar = ({ hp, hpMax, width = 25 }) => {
  const ratio = Math.max(0, Math.min(1, hp / hpMax));
  const filled = Math.round(ratio * width);
  const color = ratio > 0.5 ? 'green' : ratio > 0.2 ? 'yellow' : 'red';
  return (
    <Box>
      <Text color="gray">{'['}</Text>
      <Text color={color}>{'='.repeat(filled)}</Text>
      <Text color="gray">{'.'.repeat(Math.max(0, width - filled))}</Text>
      <Text color="gray">] {hp}/{hpMax}</Text>
    </Box>
  );
};

const TRANSITION_FRAMES = ['████████████████████', '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓', '████████████████████', '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒', '████████████████████', '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓', '████████████████████', '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒'];
const POKEBALL_THROW = [{x:0,y:-3,open:false},{x:2,y:-2,open:false},{x:4,y:0,open:false},{x:6,y:1,open:true},{x:6,y:1,open:true,flash:true},{x:6,y:1,open:true,flash:true,appear:true}];
const FLASH_FRAMES = [false,true,false,true,false,true,false];

const PHASE = { TRANSITION:'transition', THROW:'throw', FLASH:'flash', APPEAR:'appear', SELECT:'select', MESSAGE:'message', WIN:'win', LOSE:'lose' };

function eventToLog(event, nameMap) {
  const name = uid => nameMap[uid] || uid;
  switch (event.type) {
    case 'damage': return [
      `${name(event.attacker)} 使用了 ${event.move}!`,
      event.effectiveness > 1 ? '效果拔群!' : event.effectiveness === 0 ? '没有效果...' : null,
      `造成 ${event.damage} 点伤害!`,
    ].filter(Boolean);
    case 'miss': return [`${name(event.attacker)} 的攻击未命中!`];
    case 'faint': return [`${name(event.pokemon)} 倒下了!`];
    case 'fullParalyze': return [`${name(event.pokemon)} 因麻痹无法行动!`];
    case 'sleeping': return [`${name(event.pokemon)} 正在睡眠中...`];
    case 'wakeUp': return [`${name(event.pokemon)} 醒来了!`];
    case 'frozen': return [`${name(event.pokemon)} 被冻住了!`];
    case 'thaw': return [`${name(event.pokemon)} 解冻了!`];
    case 'dot': return [`${name(event.pokemon)} 受到${event.status === 'burn' ? '灼伤' : '中毒'}伤害 ${event.damage}!`];
    case 'noEffect': return [`对 ${name(event.defender)} 没有效果...`];
    case 'statusMove': return [`${name(event.attacker)} 使用了 ${event.move}!`];
    case 'secondary': return event.status ? [`${name(event.pokemon)} ${statusName(event.status)}了!`] : [];
    default: return [];
  }
}

function statusName(s) {
  return { burn: '被灼伤', paralyze: '被麻痹', sleep: '睡着', freeze: '被冰冻', poison: '中毒' }[s] ?? s;
}

const Battle = ({ playerPokemon: initialPlayer, onEnd, wildId }) => {
  const lang = getLanguage();
  const [playerMon, setPlayerMon] = useState(() => structuredClone(initialPlayer));
  const [enemyMon, setEnemyMon] = useState(null);
  const [phase, setPhase] = useState(PHASE.TRANSITION);
  const [log, setLog] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [transitionFrame, setTransitionFrame] = useState(0);
  const [throwFrame, setThrowFrame] = useState(0);
  const [flashFrame, setFlashFrame] = useState(0);
  const [enemyAppear, setEnemyAppear] = useState(0);
  const [playerAnim, setPlayerAnim] = useState(null);
  const [enemyAnim, setEnemyAnim] = useState(null);
  const [inputBlocked, setInputBlocked] = useState(false);

  const addLines = lines => setLog(prev => [...prev, ...lines].slice(-4));

  useEffect(() => {
    if (phase === PHASE.TRANSITION) {
      const t = setInterval(() => setTransitionFrame(f => (f + 1) % TRANSITION_FRAMES.length), 60);
      return () => clearInterval(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === PHASE.THROW) {
      const t = setInterval(() => {
        setThrowFrame(f => {
          if (f < POKEBALL_THROW.length - 1) return f + 1;
          clearInterval(t);
          setTimeout(() => setPhase(PHASE.FLASH), 100);
          return f;
        });
      }, 150);
      return () => clearInterval(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === PHASE.FLASH) {
      const t = setInterval(() => {
        setFlashFrame(f => {
          if (f < FLASH_FRAMES.length - 1) return f + 1;
          clearInterval(t);
          setTimeout(() => setPhase(PHASE.APPEAR), 100);
          return f;
        });
      }, 80);
      return () => clearInterval(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === PHASE.APPEAR) {
      const t = setInterval(() => {
        setEnemyAppear(a => {
          if (a >= 1) {
            clearInterval(t);
            // 添加出场动画
            const entryAnimId = animationEngine.create({
              type: 'jump',
              height: 1,
              count: 2,
              duration: 400,
            });
            setEnemyAnim({ id: entryAnimId, engine: animationEngine });
            setTimeout(() => {
              setPhase(PHASE.SELECT);
              addLines(['野生的 ' + enemyMon?.nameEn + ' 出现了!']);
              if (entryAnimId) animationEngine.remove(entryAnimId);
              setEnemyAnim(null);
            }, 400);
            return 1;
          }
          return a + 0.1;
        });
      }, 40);
      return () => clearInterval(t);
    }
  }, [phase]);

  useEffect(() => {
    async function initEnemy() {
      let enemy;
      if (wildId) {
        const species = getSpecies(wildId, BATTLE_GEN);
        const moves = await getStartingMoves(wildId, initialPlayer.level, BATTLE_GEN);
        enemy = species ? createBattlePokemon(species, initialPlayer.level, moves, BATTLE_GEN) : null;
      } else {
        enemy = await generateWildPokemon(initialPlayer.level);
      }
      if (!enemy) { onEnd({ result: 'error' }); return; }
      setEnemyMon(enemy);
      setTimeout(() => setPhase(PHASE.THROW), 1200);
    }
    initEnemy();
  }, []);

  useEffect(() => {
    if (phase === PHASE.WIN) {
      const xp = calcXpGain(enemyMon, true);
      addLines([`获得 ${xp} 经验值!`]);
      const state = store.getState();
      store.setState({ team: state.team.map(p => p.uid === playerMon.uid ? {...playerMon} : p) });
      store.save();
      setTimeout(() => onEnd({result:'win',playerMon}), 2500);
    }
    if (phase === PHASE.LOSE) setTimeout(() => onEnd({result:'lose'}), 2500);
  }, [phase]);

  useInput((input, key) => {
    if (inputBlocked || phase !== PHASE.SELECT) return;
    if (key.upArrow) setSelectedIdx(i => i < 2 ? i : i - 2);
    if (key.downArrow) setSelectedIdx(i => i >= 2 ? i : i + 2);
    if (key.leftArrow) setSelectedIdx(i => i % 2 === 1 ? i - 1 : i);
    if (key.rightArrow) setSelectedIdx(i => i % 2 === 0 ? i + 1 : i);
    if (key.return) executeMove(selectedIdx);
  });

  const executeMove = async moveIdx => {
    if (!enemyMon || phase !== PHASE.SELECT) return;
    setInputBlocked(true);  // 阻塞输入

    const pCopy = structuredClone(playerMon);
    const eCopy = structuredClone(enemyMon);
    const playerMove = pCopy.moves[moveIdx];
    if (!playerMove) { setPhase(PHASE.SELECT); setInputBlocked(false); return; }

    // 玩家攻击动画
    const animConfig = getAnimationConfig(playerMove.name, playerMove.category);
    const playerAnimId = animationEngine.create({
      ...animConfig,
      type: animConfig.type || 'lunge',
      direction: 'forward',
      duration: animConfig.duration || 300,
    });
    setPlayerAnim({ id: playerAnimId, engine: animationEngine });

    // 等待攻击动画完成
    await new Promise(r => setTimeout(r, animConfig.duration || 300));

    // 执行战斗逻辑
    const enemyMove = wildChooseMove(eCopy);
    const nameMap = {[pCopy.uid]: pCopy.nameEn, [eCopy.uid]: eCopy.nameEn};
    const events = executeTurn(pCopy, playerMove, eCopy, enemyMove);

    let lastHitAnimId = null;
    for (const event of events) {
      const lines = eventToLog(event, nameMap);
      if (lines.length) addLines(lines);
      setPlayerMon({...pCopy});
      setEnemyMon({...eCopy});

      // 如果造成伤害，播放受击动画
      if (event.type === 'damage') {
        const hitAnimId = animationEngine.create({
          type: 'classic',
          effect: 'shake',
          duration: 200,
        });
        lastHitAnimId = hitAnimId;
        setEnemyAnim({ id: hitAnimId, engine: animationEngine });
        await new Promise(r => setTimeout(r, 200));
      }

      await delay(400);
    }

    // 清理动画（用局部变量，避免 React state 陈旧闭包）
    animationEngine.remove(playerAnimId);
    if (lastHitAnimId) animationEngine.remove(lastHitAnimId);
    setPlayerAnim(null);
    setEnemyAnim(null);
    setInputBlocked(false);

    if (eCopy.hp <= 0) { addLines([`${eCopy.nameEn} 倒下了!`, '战斗胜利!']); setPhase(PHASE.WIN); }
    else if (pCopy.hp <= 0) { addLines([`${pCopy.nameEn} 倒下了!`, '你输了...']); setPhase(PHASE.LOSE); }
    else setPhase(PHASE.SELECT);
  };

  if (phase === PHASE.TRANSITION) {
    const frame = TRANSITION_FRAMES[transitionFrame];
    return (
      <Box flexDirection="column" justifyContent="center" alignItems="center" height={20}>
        <Text color="black" backgroundColor="white">{frame}</Text>
        {[...Array(18)].map((_, i) => <Text key={i} color="white" backgroundColor="black">{'                    '}</Text>)}
        <Box marginTop={1}><Text color="yellow">野生的宝可梦？</Text></Box>
      </Box>
    );
  }

  if (phase === PHASE.THROW || phase === PHASE.FLASH || phase === PHASE.APPEAR) {
    const tf = POKEBALL_THROW[Math.min(throwFrame, POKEBALL_THROW.length - 1)];
    const isFlash = phase === PHASE.FLASH ? FLASH_FRAMES[flashFrame] : false;
    const isAppearing = phase === PHASE.APPEAR;
    return (
      <Box flexDirection="column" justifyContent="center" alignItems="center" height={20}>
        {(isFlash || isAppearing) && <Box position="absolute" top={0} left={0} width={60} height={20}><Text backgroundColor={isFlash ? (flashFrame%2===0?'white':'cyan') : 'black'}>{'                                                '}</Text></Box>}
        <Box position="absolute" top={8+tf.y} left={25+tf.x}><Text color="red">●</Text><Text color="white">○</Text>{tf.open && <Text color="red"> ◐</Text>}</Box>
        {isAppearing && enemyMon && <Box position="absolute" top={5} left={35} opacity={enemyAppear}><AnimatedSprite pokemonId={enemyMon.id} pokemonType={enemyMon.type} width={18} height={9} showBorder={false} animation={enemyAnim} /></Box>}
        <Box marginTop={10}><Text color={isFlash?'yellow':'white'}>{phase === PHASE.THROW ? '就决定是你了!' : phase === PHASE.FLASH ? '' : `野生的 ${enemyMon?.nameEn} 出现了!`}</Text></Box>
      </Box>
    );
  }

  if (!enemyMon) return <Box><Text color="gray">Loading...</Text></Box>;

  const pName = playerMon.nameEn, eName = enemyMon.nameEn, moves = playerMon.moves || [];

  return (
    <Box flexDirection="column" paddingX={0} paddingY={0}>
      <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
        <Box flexDirection="column" width={28}>
          <Text color="white" bold>{eName}  Lv.{enemyMon.level}</Text>
          <HPBar hp={enemyMon.hp} hpMax={enemyMon.hpMax} width={18} />
        </Box>
        <AnimatedSprite pokemonId={enemyMon.id} pokemonType={enemyMon.type} width={20} height={10} showBorder={false} animation={enemyAnim} />
      </Box>
      <Box height={1} />
      <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
        <AnimatedSprite pokemonId={playerMon.id} pokemonType={playerMon.type} width={20} height={10} variant="back" showBorder={false} animation={playerAnim} />
        <Box flexDirection="column" width={28} alignItems="flex-end">
          <Text color="white" bold>{pName}  Lv.{playerMon.level}</Text>
          <HPBar hp={playerMon.hp} hpMax={playerMon.hpMax} width={18} />
        </Box>
      </Box>
      <Box marginTop={0} borderStyle="double" borderColor="white" paddingX={1} height={6} flexDirection="column">
        {(phase === PHASE.SELECT || phase === PHASE.MESSAGE) && (
          <Box flexDirection="column" flexGrow={1}>
            <Text color="white">要怎么做?</Text>
            <Box flexDirection="row" flexWrap="wrap" marginTop={0} columnGap={3}>
              {[0,1,2,3].map(i => {
                const move = moves[i];
                const isSelected = i === selectedIdx;
                if (!move) return <Text key={i} color="gray">--------</Text>;
                const moveName = lang === 'en' ? move.name : (move.nameZh || move.name);
                return <Text key={i} color={isSelected?'green':'white'} bold={isSelected}>{isSelected?'▶':' '} {moveName}</Text>;
              })}
            </Box>
            <Text color="cyan" dimColor>↑↓←→ 选择   Enter 确认</Text>
          </Box>
        )}
        {phase === PHASE.WIN && <Box flexGrow={1} alignItems="center" justifyContent="center"><Text color="green" bold>★ 战斗胜利 ★</Text></Box>}
        {phase === PHASE.LOSE && <Box flexGrow={1} alignItems="center" justifyContent="center"><Text color="red" bold>战斗失败...</Text></Box>}
      </Box>
    </Box>
  );
};

const delay = ms => new Promise(r => setTimeout(r, ms));
export default Battle;
