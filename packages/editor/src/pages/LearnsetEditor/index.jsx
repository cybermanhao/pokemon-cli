import React, { useState, useEffect, useMemo } from 'react';
import { getAllSpeciesNames, gen } from '../../lib/dex';

export default function LearnsetEditor() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const [learnset, setLearnset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('levelUp');

  // Get all species names
  const allNames = useMemo(() => getAllSpeciesNames(), []);

  // Filter
  const filteredNames = useMemo(() => {
    if (!filter) return allNames.slice(0, 200);
    const f = filter.toLowerCase();
    return allNames.filter((n) => n.toLowerCase().includes(f)).slice(0, 200);
  }, [allNames, filter]);

  // Load learnset when species selected
  useEffect(() => {
    if (!selected) {
      setLearnset(null);
      return;
    }
    setLoading(true);
    setLearnset(null);

    gen.learnsets.get(selected).then((data) => {
      if (!data) {
        setLearnset({ levelUp: [], eggMoves: [], tmMoves: [] });
        setLoading(false);
        return;
      }

      const levelUp = [];
      const eggMoves = [];
      const tmMoves = [];

      for (const [move, sources] of Object.entries(data)) {
        for (const source of sources) {
          if (source.startsWith('9L')) {
            levelUp.push({ move, level: parseInt(source.slice(2), 10) });
          } else if (source === '9E') {
            eggMoves.push(move);
          } else if (source === '9M' || source === '9T') {
            tmMoves.push(move);
          }
        }
      }

      levelUp.sort((a, b) => a.level - b.level);
      setLearnset({ levelUp, eggMoves, tmMoves });
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLearnset({ levelUp: [], eggMoves: [], tmMoves: [] });
      setLoading(false);
    });
  }, [selected]);

  const tabs = [
    { id: 'levelUp', label: '升级', count: learnset?.levelUp?.length || 0 },
    { id: 'egg', label: '蛋招', count: learnset?.eggMoves?.length || 0 },
    { id: 'tm', label: 'TM', count: learnset?.tmMoves?.length || 0 },
  ];

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left - species list */}
      <div style={{ width: 250, borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 8, borderBottom: '1px solid #ddd' }}>
          <input
            type="text"
            placeholder="搜索精灵..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredNames.map((name) => (
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
      </div>

      {/* Right - learnset */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selected ? (
          <div style={{ padding: 20 }}>
            <h2 style={{ margin: '0 0 16px 0' }}>{selected}</h2>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    background: activeTab === tab.id ? '#1976d2' : '#e0e0e0',
                    color: activeTab === tab.id ? 'white' : '#333',
                    cursor: 'pointer',
                    borderRadius: 4,
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Content */}
            {loading ? (
              <div>加载中...</div>
            ) : (
              <div>
                {activeTab === 'levelUp' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #ddd' }}>等级</th>
                        <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #ddd' }}>技能</th>
                      </tr>
                    </thead>
                    <tbody>
                      {learnset?.levelUp?.map((entry) => (
                        <tr key={entry.move}>
                          <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{entry.level}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{entry.move}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'egg' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {learnset?.eggMoves?.map((move) => (
                      <span key={move} style={{ padding: '4px 8px', background: '#e8f5e9', borderRadius: 4 }}>
                        {move}
                      </span>
                    ))}
                  </div>
                )}

                {activeTab === 'tm' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {learnset?.tmMoves?.map((move) => (
                      <span key={move} style={{ padding: '4px 8px', background: '#fff3e0', borderRadius: 4 }}>
                        {move}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 20, color: '#666' }}>
            从左侧选择一个精灵查看升级表
          </div>
        )}
      </div>
    </div>
  );
}
