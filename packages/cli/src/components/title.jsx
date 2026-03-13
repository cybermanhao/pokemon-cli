// src/components/title.jsx
import React from 'react';
import { Box, Text } from 'ink';

const TitleScreen = ({ onStart }) => {
  return (
    <Box flexDirection="column" alignItems="center" padding={2}>
      <Text bold color="cyan">
        POKEMON CLI
      </Text>
      <Text color="yellow">Press any key to start...</Text>
    </Box>
  );
};

export default TitleScreen;
