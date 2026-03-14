import React, { useState, useCallback } from 'react';
import { readModData, writeModData } from './lib/ipc';
import DexEditor from './pages/DexEditor';
import MovesEditor from './pages/MovesEditor';
import ItemsEditor from './pages/ItemsEditor';
import SpriteStudio from './pages/SpriteStudio';
import LearnsetEditor from './pages/LearnsetEditor';

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
