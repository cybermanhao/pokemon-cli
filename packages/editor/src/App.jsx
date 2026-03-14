import React, { useState, useCallback, useMemo } from 'react';
import { readModData, writeModData } from './lib/ipc';
import { gen, Dex } from './lib/dex';
import DexEditor from './pages/DexEditor';
import MovesEditor from './pages/MovesEditor';
import ItemsEditor from './pages/ItemsEditor';
import SpriteStudio from './pages/SpriteStudio';
import LearnsetEditor from './pages/LearnsetEditor';

// Load official Gen 9 data
function loadOfficialData() {
  const officialSpecies = {};
  for (const s of gen.species) {
    officialSpecies[s.name] = {
      name: s.name,
      num: s.num,
      baseStats: { ...s.baseStats },
      types: [...s.types],
      abilities: [...s.abilities],
    };
  }

  const officialMoves = {};
  for (const m of gen.moves) {
    officialMoves[m.name] = {
      name: m.name,
      num: m.num,
      type: m.type,
      category: m.category,
      pp: m.pp,
      power: m.power,
      accuracy: m.accuracy,
    };
  }

  // Items need special handling - use raw JS format
  const itemsObj = {};
  for (const item of gen.items) {
    itemsObj[item.name] = {
      name: item.name,
      num: item.num,
    };
  }
  const itemsRaw = `{\n${Object.entries(itemsObj).map(([name, data]) =>
    `  '${name}': ${JSON.stringify(data, null, 2)}`
  ).join(',\n')}\n}`;

  return { officialSpecies, officialMoves, itemsRaw };
}

function App() {
  const [active, setActive] = useState('dex');
  const [modPath, setModPath] = useState('');
  const [species, setSpecies] = useState({});
  const [moves, setMoves] = useState({});
  const [itemsRaw, setItemsRaw] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Load mod data from path
  const loadMod = useCallback(async (path) => {
    if (!path) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await readModData(path);
      setSpecies(data.species || {});
      setMoves(data.moves || {});
      setItemsRaw(data.items_raw || '{}');
    } catch (e) {
      setMessage(`加载失败: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save mod data
  const saveMod = useCallback(async () => {
    if (!modPath) {
      setMessage('请先设置 mod.js 路径');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await writeModData(modPath, species, moves, itemsRaw);
      setMessage('保存成功!');
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      setMessage(`保存失败: ${e}`);
    } finally {
      setSaving(false);
    }
  }, [modPath, species, moves, itemsRaw]);

  const tabs = [
    { id: 'dex', label: 'Pokédex' },
    { id: 'moves', label: '技能' },
    { id: 'items', label: '道具' },
    { id: 'sprites', label: '精灵图' },
    { id: 'learnset', label: '升级表' },
  ];

  const renderPage = () => {
    switch (active) {
      case 'dex':
        return (
          <DexEditor
            species={species}
            setSpecies={setSpecies}
            moves={moves}
            itemsRaw={itemsRaw}
          />
        );
      case 'moves':
        return (
          <MovesEditor
            moves={moves}
            setMoves={setMoves}
          />
        );
      case 'items':
        return (
          <ItemsEditor
            itemsRaw={itemsRaw}
            setItemsRaw={setItemsRaw}
          />
        );
      case 'sprites':
        return <SpriteStudio />;
      case 'learnset':
        return <LearnsetEditor />;
      default:
        return null;
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        background: '#f5f5f5',
        borderBottom: '1px solid #ddd',
      }}>
        <strong>Pokémon Editor</strong>

        <input
          type="text"
          placeholder="输入 mod.js 路径..."
          value={modPath}
          onChange={(e) => setModPath(e.target.value)}
          style={{ flex: 1, maxWidth: 400, padding: '4px 8px' }}
        />
        <button onClick={() => loadMod(modPath)} disabled={loading || !modPath}>
          {loading ? '加载中...' : '加载'}
        </button>
        <button onClick={() => {
          const { officialSpecies, officialMoves, itemsRaw } = loadOfficialData();
          setSpecies(officialSpecies);
          setMoves(officialMoves);
          setItemsRaw(itemsRaw);
          setMessage('已加载 Gen9 官方数据!');
          setTimeout(() => setMessage(''), 2000);
        }}>
          加载官方数据
        </button>
        <button onClick={saveMod} disabled={saving || !modPath}>
          {saving ? '保存中...' : '保存'}
        </button>
        {message && <span style={{ color: message.includes('失败') ? 'red' : 'green' }}>{message}</span>}
      </nav>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px', background: '#eee' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: active === tab.id ? 'white' : '#ddd',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'auto', background: 'white' }}>
        {renderPage()}
      </div>
    </div>
  );
}

export default App;
