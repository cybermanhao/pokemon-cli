import React, { useState, useMemo } from 'react';

const TYPES = [
  'Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel',
  'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy',
];

const CATEGORIES = ['Physical', 'Special', 'Status'];

const TARGETS = [
  'normal', 'self', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf', 'any',
  'all', 'allAdjacent', 'allAdjacentFoes', 'random', 'randomNormal',
];

export default function MovesEditor({ moves, setMoves }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');

  // Filter moves
  const filteredMoves = useMemo(() => {
    const all = Object.keys(moves);
    if (!filter) return all.sort();
    const f = filter.toLowerCase();
    return all.filter((n) => n.toLowerCase().includes(f)).sort();
  }, [moves, filter]);

  // Handle add/update
  const handleUpdate = (name, updates) => {
    setMoves({ ...moves, [name]: { name, ...moves[name], ...updates } });
  };

  // Handle delete
  const handleDelete = (name) => {
    const { [name]: _, ...rest } = moves;
    setMoves(rest);
    if (selected === name) setSelected(null);
  };

  // Handle add new
  const handleAdd = (name) => {
    if (moves[name]) {
      setSelected(name);
      return;
    }
    const newMove = {
      name,
      num: 10000 + Object.keys(moves).length + 1,
      type: 'Normal',
      category: 'Physical',
      pp: 30,
      power: 80,
      accuracy: 100,
    };
    setMoves({ ...moves, [name]: newMove });
    setSelected(name);
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left - move list */}
      <div style={{ width: 250, borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 8, borderBottom: '1px solid #ddd' }}>
          <input
            type="text"
            placeholder="搜索技能..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredMoves.map((name) => (
            <div
              key={name}
              onClick={() => setSelected(name)}
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
        <div style={{ padding: 8, borderTop: '1px solid #ddd' }}>
          <input
            type="text"
            placeholder="新技能名称..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                handleAdd(e.target.value.trim());
                e.target.value = '';
              }
            }}
            style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Right - form */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selected && moves[selected] ? (
          <MoveForm
            name={selected}
            data={moves[selected]}
            onUpdate={(updates) => handleUpdate(selected, updates)}
            onDelete={() => handleDelete(selected)}
          />
        ) : (
          <div style={{ padding: 20, color: '#666' }}>
            从左侧选择一个技能进行编辑
          </div>
        )}
      </div>
    </div>
  );
}

function MoveForm({ name, data, onUpdate, onDelete }) {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{name}</h2>
        <button onClick={onDelete} style={{ background: '#ffebee', color: '#c62828' }}>删除</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>编号 (num)</label>
          <input
            type="number"
            value={data.num || ''}
            onChange={(e) => onUpdate({ num: parseInt(e.target.value, 10) || 0 })}
            style={{ width: '100%', padding: '6px 8px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>属性</label>
          <select
            value={data.type || 'Normal'}
            onChange={(e) => onUpdate({ type: e.target.value })}
            style={{ width: '100%', padding: '6px 8px' }}
          >
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>分类</label>
          <select
            value={data.category || 'Physical'}
            onChange={(e) => onUpdate({ category: e.target.value })}
            style={{ width: '100%', padding: '6px 8px' }}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>目标</label>
          <select
            value={data.target || 'normal'}
            onChange={(e) => onUpdate({ target: e.target.value })}
            style={{ width: '100%', padding: '6px 8px' }}
          >
            {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>PP</label>
          <input
            type="number"
            value={data.pp || 30}
            onChange={(e) => onUpdate({ pp: parseInt(e.target.value, 10) || 0 })}
            style={{ width: '100%', padding: '6px 8px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>威力</label>
          <input
            type="number"
            value={data.power || ''}
            onChange={(e) => onUpdate({ power: parseInt(e.target.value, 10) || 0 })}
            style={{ width: '100%', padding: '6px 8px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>命中率</label>
          <input
            type="number"
            value={data.accuracy || 100}
            onChange={(e) => onUpdate({ accuracy: parseInt(e.target.value, 10) || 0 })}
            style={{ width: '100%', padding: '6px 8px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>优先级</label>
          <input
            type="number"
            value={data.priority || 0}
            onChange={(e) => onUpdate({ priority: parseInt(e.target.value, 10) || 0 })}
            style={{ width: '100%', padding: '6px 8px' }}
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>描述</label>
        <textarea
          value={data.desc || ''}
          onChange={(e) => onUpdate({ desc: e.target.value })}
          style={{ width: '100%', padding: '6px 8px', minHeight: 60 }}
        />
      </div>
    </div>
  );
}
