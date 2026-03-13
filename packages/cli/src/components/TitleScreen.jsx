import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { t, getLanguage } from '@pokemon/i18n';
import PokemonSprite from './PokemonSprite.jsx';
import { usePreloadSprites } from '../hooks/useAsciiSprite.js';

const LOGO = [
  '██████╗  ██████╗ ██╗  ██╗███████╗███╗   ███╗ ██████╗ ███╗',
  '██╔══██╗██╔═══██╗██║ ██╔╝██╔════╝████╗ ████║██╔═══██╗████╗',
  '██████╔╝██║   ██║█████╔╝ █████╗  ██╔████╔██║██║   ██║██╔██╗',
  '██╔═══╝ ██║   ██║██╔═██╗ ██╔══╝  ██║╚██╔╝██║██║   ██║██║╚██╗',
  '██║     ╚██████╔╝██║  ██╗███████╗██║ ╚═╝ ██║╚██████╔╝██║ ╚████║',
  '╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝',
];

const ROTATING_STARTERS = [
  { id: 25, type: 'electric' },
  { id: 4, type: 'fire' },
  { id: 7, type: 'water' },
  { id: 1, type: 'grass' },
];

const TitleScreen = ({ onStart, hasSave }) => {
  const [blink, setBlink] = useState(true);
  const [starterIdx, setStarterIdx] = useState(0);

  usePreloadSprites(ROTATING_STARTERS.map(s => s.id), { width: 28, height: 14 });

  useEffect(() => {
    const blinkTimer = setInterval(() => setBlink(b => !b), 600);
    const rotateTimer = setInterval(() => setStarterIdx(i => (i + 1) % ROTATING_STARTERS.length), 3000);
    return () => { clearInterval(blinkTimer); clearInterval(rotateTimer); };
  }, []);

  useInput(() => onStart());

  const current = ROTATING_STARTERS[starterIdx];

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        {LOGO.map((line, i) => (
          <Text key={i} color="yellow" bold>{line}</Text>
        ))}
        <Text color="cyan">─── CLI Edition ───</Text>
      </Box>

      <PokemonSprite pokemonId={current.id} pokemonType={current.type} width={28} height={14} showBorder />

      <Box marginTop={1}>
        <Text color={blink ? 'white' : 'gray'} bold>
          ▶  {t('pressStart')}  ◀
        </Text>
      </Box>

      {hasSave && <Text color="green" dimColor>存档已找到</Text>}

      <Box marginTop={1}>
        <Text color="gray" dimColor>v1.0.0</Text>
      </Box>
    </Box>
  );
};

export default TitleScreen;
