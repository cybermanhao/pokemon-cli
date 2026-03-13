import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';
import { t } from '@pokemon/i18n';

// Debug helper - only logs when DEBUG env is set
const debug = (...args) => {
  if (process.env.DEBUG) console.error('[DEBUG]', ...args);
};

const MainMenu = ({ hasSave, onNewGame, onContinue, onQuit }) => {
  const items = [
    { label: t('newGame'), value: 'new' },
    ...(hasSave ? [{ label: t('continueGame'), value: 'continue' }] : []),
    { label: t('quit'), value: 'quit' },
  ];
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    debug('input:', input, 'key:', key.name);

    if (key.upArrow) {
      setSelectedIndex(i => (i > 0 ? i - 1 : items.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => (i < items.length - 1 ? i + 1 : 0));
    } else if (key.return) {
      const selected = items[selectedIndex];
      debug('selected:', selected.value);
      if (selected.value === 'new') onNewGame();
      else if (selected.value === 'continue') onContinue();
      else if (selected.value === 'quit') onQuit();
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Text color="yellow" bold>═══ {t('title')} ═══</Text>
      <Box marginTop={1} flexDirection="column" alignItems="flex-start" minWidth={20}>
        {items.map((item, index) => (
          <Text key={item.value} color={index === selectedIndex ? 'green' : 'white'} bold={index === selectedIndex}>
            {index === selectedIndex ? '❯ ' : '  '}{item.label}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>方向键选择  Enter 确认</Text>
      </Box>
    </Box>
  );
};

export default MainMenu;
