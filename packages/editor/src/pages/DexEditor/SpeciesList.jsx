import React, { useState, useMemo } from 'react';

export default function SpeciesList({
  names,
  species,
  selected,
  onSelect,
  onAdd,
  filter,
  onFilterChange,
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // Separate custom and official
  const { custom, official } = useMemo(() => {
    const customNames = Object.keys(species);
    const official = names.filter((n) => !customNames.includes(n));
    return { custom: customNames.sort(), official };
  }, [names, species]);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (newName.trim()) {
      onAdd(newName.trim());
      setNewName('');
      setAdding(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: 8, borderBottom: '1px solid #ddd' }}>
        <input
          type="text"
          placeholder="搜索精灵..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
        />
      </div>

      {/* Custom species */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {custom.length > 0 && (
          <div>
            <div style={{ padding: '8px', fontWeight: 'bold', background: '#f0f0f0', fontSize: 12 }}>
              自定义 ({custom.length})
            </div>
            {custom.map((name) => (
              <div
                key={name}
                onClick={() => onSelect(name)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: selected === name ? '#e3f2fd' : 'white',
                  borderBottom: '1px solid #eee',
                }}
              >
                {name}
              </div>
            ))}
          </div>
        )}

        {/* Official species */}
        <div>
          <div style={{ padding: '8px', fontWeight: 'bold', background: '#f0f0f0', fontSize: 12 }}>
            官方图鉴 ({official.length})
          </div>
          {official.slice(0, 200).map((name) => (
            <div
              key={name}
              onClick={() => onSelect(name)}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                background: selected === name ? '#e3f2fd' : 'white',
                borderBottom: '1px solid #eee',
                color: '#666',
              }}
            >
              {name}
            </div>
          ))}
          {official.length > 200 && (
            <div style={{ padding: 8, color: '#999', fontSize: 12 }}>
              还有 {official.length - 200} 个精灵...
            </div>
          )}
        </div>
      </div>

      {/* Add button */}
      <div style={{ padding: 8, borderTop: '1px solid #ddd' }}>
        {adding ? (
          <form onSubmit={handleAddSubmit}>
            <input
              type="text"
              placeholder="精灵名称..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box', marginBottom: 4 }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="submit" style={{ flex: 1 }}>添加</button>
              <button type="button" onClick={() => setAdding(false)}>取消</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} style={{ width: '100%' }}>
            + 添加精灵
          </button>
        )}
      </div>
    </div>
  );
}
