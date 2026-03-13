// src/app.jsx
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TitleScreen from './components/title.jsx';

const App = () => {
  const [screen, setScreen] = useState('title'); // title, menu, battle, explore

  return (
    <Box flexDirection="column">
      {screen === 'title' && <TitleScreen onStart={() => setScreen('menu')} />}
      {screen === 'menu' && (
        <Box>
          <Text>Game Menu</Text>
        </Box>
      )}
    </Box>
  );
};

export default App;
