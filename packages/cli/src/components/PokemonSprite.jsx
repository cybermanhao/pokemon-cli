import React from 'react';
import { Box, Text } from 'ink';
import { useAsciiSprite } from '../hooks/useAsciiSprite.js';

const TYPE_BORDER_COLORS = {
  fire:'red', water:'blue', grass:'green', poison:'magenta', normal:'white',
  electric:'yellow', psychic:'magenta', ice:'cyan', dragon:'blue', dark:'gray',
  steel:'white', fairy:'magenta', fighting:'red', bug:'green', ghost:'magenta',
  rock:'yellow', ground:'yellow', flying:'cyan',
};

const PokemonSprite = ({ pokemonId, pokemonType='normal', width=32, height=16, variant='front', showBorder=true, label, dim=false }) => {
  const { lines, loading } = useAsciiSprite(pokemonId, { width, height, variant });
  const borderColor = TYPE_BORDER_COLORS[pokemonType] || 'white';

  const inner = (
    <Box flexDirection="column" alignItems="center">
      {loading && <Box height={height} alignItems="center" justifyContent="center" width={width}><Text color="gray">loading...</Text></Box>}
      {!loading && Array.isArray(lines) && lines.map((line, i) => <Text key={i} dimColor={dim}>{line}</Text>)}
      {!loading && !Array.isArray(lines) && <Box height={height} alignItems="center" justifyContent="center" width={width}><Text color="gray">no sprite</Text></Box>}
      {label && <Text color="gray" dimColor>{label}</Text>}
    </Box>
  );

  if (!showBorder) return inner;
  return <Box borderStyle="round" borderColor={borderColor} paddingX={1}>{inner}</Box>;
};

export default PokemonSprite;
