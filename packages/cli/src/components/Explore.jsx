import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { t, getLanguage } from '@pokemon/i18n';
import { store } from '../store/gameState.js';

const Explore = ({ onBattle, onMenu }) => {
  const [steps, setSteps] = useState(0);
  const [message, setMessage] = useState('');
  const lang = getLanguage();
  const state = store.getState();
  const mon = state.team?.[0];

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 1500);
      return () => clearTimeout(t);
    }
  }, [message]);

  useInput((input, key) => {
    const move = key.upArrow || key.downArrow || key.leftArrow || key.rightArrow;
    if (move) {
      const newSteps = steps + 1;
      setSteps(newSteps);
      store.setState({ steps: (state.steps || 0) + 1 });
      if (newSteps % (10 + Math.floor(Math.random() * 5)) === 0) {
        setMessage('野生宝可梦出现了!');
        setTimeout(() => onBattle(), 800);
      }
    }
    if (input === 'b' || input === 'B') onBattle();
    if (input === 'm' || input === 'M' || key.escape) onMenu?.();
  });

  const monName = mon ? (lang === 'en' ? mon.nameEn : mon.nameZh) : '---';
  const hpRatio = mon ? mon.hp / mon.hpMax : 0;
  const hpColor = hpRatio > 0.5 ? 'green' : hpRatio > 0.25 ? 'yellow' : 'red';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="green" bold>🌿 草丛探索</Text>
        <Text color="gray">步数: {steps}</Text>
      </Box>

      <Box borderStyle="round" borderColor="green" height={10} flexDirection="column" alignItems="center" justifyContent="center">
        <Text color="green">
          {['🌲 🌿 🌲 🌿 🌲 🌿 🌿', '🌿 🌲 🌿 🌲 🌿 🌲 🌿', '🌲 🌿 🌲 🌿 🌲 🌿 🌲', '🌿 🌲  ☻  🌲 🌿 🌲 🌿', '🌲 🌿 🌲 🌿 🌲 🌿 🌲'].map((row, i) => <Text key={i}>{row}</Text>)}
        </Text>
        {message && <Text color="yellow" bold>{message}</Text>}
      </Box>

      {mon && (
        <Box marginTop={1} flexDirection="row" gap={3} alignItems="center">
          <Text color="cyan" bold>{monName}</Text>
          <Text color="gray">Lv.{mon.level}</Text>
          <Text color="gray">HP:</Text>
          <Text color={hpColor}>{mon.hp}/{mon.hpMax}</Text>
        </Box>
      )}

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={2}>
        <Text color="gray" dimColor>方向键/WASD 移动  B 遭遇战斗  M/Esc 菜单</Text>
      </Box>
    </Box>
  );
};

export default Explore;
