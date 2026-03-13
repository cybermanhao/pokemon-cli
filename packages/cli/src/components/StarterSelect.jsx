import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { t, getLanguage } from '@pokemon/i18n';
import PokemonSprite from './PokemonSprite.jsx';
import { getSpecies, getStartingMoves, createBattlePokemon } from '@pokemon/battle';
import { store } from '../store/gameState.js';

const STARTER_NAMES = ['Bulbasaur', 'Charmander', 'Squirtle'];
const TYPE_COLORS = { grass: 'green', fire: 'red', water: 'blue' };

const StarterSelect = ({ onSelect }) => {
  const [starters, setStarters] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const lang = getLanguage();

  useEffect(() => {
    const data = STARTER_NAMES.map(name => {
      const s = getSpecies(name, 1);
      return { id: s.num, species: s, moves: getStartingMoves(s.id, 5, 1) };
    });
    setStarters(data);
  }, []);

  useInput((input, key) => {
    if (!starters) return;
    if (confirming) {
      if (key.leftArrow || input === 'n') setConfirming(false);
      if (key.rightArrow || input === 'y' || key.return) {
        const { species, moves } = starters[selectedIdx];
        const instance = createBattlePokemon(species, 5, moves, 1);
        store.setState({ team: [instance], started: true });
        store.save();
        onSelect(instance);
      }
      return;
    }
    if (key.leftArrow) setSelectedIdx(i => (i - 1 + STARTER_NAMES.length) % STARTER_NAMES.length);
    if (key.rightArrow) setSelectedIdx(i => (i + 1) % STARTER_NAMES.length);
    if (key.return) setConfirming(true);
  });

  if (!starters) return <Box flexDirection="column" alignItems="center"><Text color="gray">加载中...</Text></Box>;

  const { species } = starters[selectedIdx];
  const name = lang === 'en' ? species.name : species.nameZh || species.name;
  const typeColor = TYPE_COLORS[species.type1] || 'white';

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Text color="yellow" bold>{t('chooseStarter')}</Text>
      <Text color="gray" dimColor>← → 选择  Enter 确定</Text>

      <Box flexDirection="row" marginTop={1} gap={2}>
        {starters.map(({ species: s }, idx) => {
          const sName = lang === 'en' ? s.name : s.nameZh || s.name;
          const isSelected = idx === selectedIdx;
          return (
            <Box key={s.id} flexDirection="column" alignItems="center">
              <PokemonSprite pokemonId={s.num} pokemonType={s.type1} width={20} height={10} showBorder={isSelected} />
              <Text color={isSelected ? TYPE_COLORS[s.type1] || 'white' : 'gray'} bold={isSelected}>
                {isSelected ? `▶ ${sName} ◀` : sName}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor={typeColor} paddingX={3}>
        <Text color={typeColor} bold>{name}</Text>
        <Box flexDirection="row" gap={3}>
          <Text color="gray">HP: {species.baseStats.hp}</Text>
          <Text color="gray">ATK: {species.baseStats.atk}</Text>
          <Text color="gray">DEF: {species.baseStats.def}</Text>
        </Box>
      </Box>

      {confirming && (
        <Box marginTop={1} borderStyle="double" borderColor="yellow" paddingX={4}>
          <Text color="yellow">{name}？</Text>
          <Box flexDirection="row" gap={4}>
            <Text color="green">→ {t('yes')} (Y)</Text>
            <Text color="red">← {t('no')} (N)</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default StarterSelect;
