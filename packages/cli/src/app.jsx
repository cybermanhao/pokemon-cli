import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { setLanguage } from '@pokemon/i18n';
import TitleScreen from './components/TitleScreen.jsx';
import MainMenu from './components/MainMenu.jsx';
import StarterSelect from './components/StarterSelect.jsx';
import Battle from './components/Battle.jsx';
import Explore from './components/Explore.jsx';
import { store } from './store/gameState.js';

const SCREENS = {
  TITLE: 'title',
  MENU: 'menu',
  STARTER_SELECT: 'starter_select',
  EXPLORE: 'explore',
  BATTLE: 'battle',
};

const App = () => {
  const [screen, setScreen] = useState(SCREENS.TITLE);
  const [hasSave, setHasSave] = useState(false);
  const [battleData, setBattleData] = useState(null);

  useEffect(() => {
    const saved = store.hasSave();
    setHasSave(saved);
    if (saved) {
      store.load();
      const { lang } = store.getState();
      if (lang) setLanguage(lang);
    }
  }, []);

  const handleTitleStart = () => setScreen(SCREENS.MENU);
  const handleNewGame = () => { store.setState({ started: false, team: [] }); setScreen(SCREENS.STARTER_SELECT); };
  const handleContinue = () => { store.load(); setScreen(SCREENS.EXPLORE); };
  const handleStarterChosen = () => setScreen(SCREENS.EXPLORE);

  const handleBattleEnd = ({ result, playerMon }) => {
    if (result === 'win' && playerMon) {
      const state = store.getState();
      const newTeam = state.team.map(p => p.uid === playerMon.uid ? playerMon : p);
      store.setState({ team: newTeam });
      store.save();
    }
    setBattleData(null);
    setScreen(SCREENS.EXPLORE);
  };

  const triggerWildBattle = () => {
    const state = store.getState();
    if (!state.team?.length) return;
    setBattleData({ playerPokemon: state.team[0] });
    setScreen(SCREENS.BATTLE);
  };

  return (
    <Box flexDirection="column">
      {screen === SCREENS.TITLE && <TitleScreen onStart={handleTitleStart} hasSave={hasSave} />}
      {screen === SCREENS.MENU && (
        <MainMenu hasSave={hasSave} onNewGame={handleNewGame} onContinue={handleContinue} onQuit={() => process.exit(0)} />
      )}
      {screen === SCREENS.STARTER_SELECT && <StarterSelect onSelect={handleStarterChosen} />}
      {screen === SCREENS.EXPLORE && <Explore onBattle={triggerWildBattle} onMenu={() => setScreen(SCREENS.MENU)} />}
      {screen === SCREENS.BATTLE && battleData && (
        <Battle playerPokemon={battleData.playerPokemon} wildId={battleData.wildId} onEnd={handleBattleEnd} />
      )}
    </Box>
  );
};

export default App;
