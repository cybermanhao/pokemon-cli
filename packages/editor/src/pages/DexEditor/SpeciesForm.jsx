import React from 'react';
import { getAllAbilityNames, TYPES } from '../../lib/dex';

const ABILITIES = getAllAbilityNames();

function StatInput({ label, statKey, stats, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ width: 40, fontWeight: 'bold' }}>{label}</label>
      <input
        type="number"
        value={stats[statKey] || 0}
        onChange={(e) => onChange({ ...stats, [statKey]: parseInt(e.target.value, 10) || 0 })}
        style={{ width: 60, padding: '4px 8px' }}
      />
    </div>
  );
}

function TypeSelect({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ width: 50 }}>{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, padding: '4px 8px' }}
      >
        <option value="">-</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}

function AbilitySelect({ value, onChange, label, required }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ width: 80 }}>{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, padding: '4px 8px' }}
      >
        <option value="">{required ? '(必选)' : '-'}</option>
        {ABILITIES.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    </div>
  );
}

export default function SpeciesForm({ name, data, onUpdate, onDelete, onFork, isCustom }) {
  const stats = data.baseStats || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const types = data.types || [];
  const abilities = data.abilities || [];

  const handleStatsChange = (newStats) => {
    onUpdate({ baseStats: newStats });
  };

  const handleType1Change = (type1) => {
    onUpdate({ types: [type1, types[1] || ''] });
  };

  const handleType2Change = (type2) => {
    onUpdate({ types: [types[0] || '', type2] });
  };

  const handleAbility1Change = (ability1) => {
    onUpdate({ abilities: [ability1, abilities[1] || '', abilities[2] || ''] });
  };

  const handleAbility2Change = (ability2) => {
    onUpdate({ abilities: [abilities[0] || '', ability2, abilities[2] || ''] });
  };

  const handleHiddenAbilityChange = (hidden) => {
    onUpdate({ abilities: [abilities[0] || '', abilities[1] || '', hidden] });
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{name}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {isCustom && (
            <>
              <button onClick={onFork}>复制</button>
              <button onClick={onDelete} style={{ background: '#ffebee', color: '#c62828' }}>删除</button>
            </>
          )}
        </div>
      </div>

      {/* Inherit checkbox */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={data.inherit === true}
            onChange={(e) => onUpdate({ inherit: e.target.checked ? true : undefined })}
          />
          继承官方数据 (inherit: true)
        </label>
        <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0 24px' }}>
          启用后，未编辑的字段将使用官方数据
        </p>
      </div>

      {/* Number */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          编号 (num):
          <input
            type="number"
            value={data.num || ''}
            onChange={(e) => onUpdate({ num: parseInt(e.target.value, 10) || 0 })}
            style={{ width: 80, padding: '4px 8px' }}
          />
        </label>
      </div>

      {/* Base Stats */}
      <fieldset style={{ marginBottom: 16, padding: 12 }}>
        <legend style={{ fontWeight: 'bold' }}>基础属性</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <StatInput label="HP" statKey="hp" stats={stats} onChange={handleStatsChange} />
          <StatInput label="攻击" statKey="atk" stats={stats} onChange={handleStatsChange} />
          <StatInput label="防御" statKey="def" stats={stats} onChange={handleStatsChange} />
          <StatInput label="特攻" statKey="spa" stats={stats} onChange={handleStatsChange} />
          <StatInput label="特防" statKey="spd" stats={stats} onChange={handleStatsChange} />
          <StatInput label="速度" statKey="spe" stats={stats} onChange={handleStatsChange} />
        </div>
        <div style={{ marginTop: 8, textAlign: 'right', fontWeight: 'bold' }}>
          总计: {Object.values(stats).reduce((a, b) => a + b, 0)}
        </div>
      </fieldset>

      {/* Types */}
      <fieldset style={{ marginBottom: 16, padding: 12 }}>
        <legend style={{ fontWeight: 'bold' }}>属性</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <TypeSelect value={types[0]} onChange={handleType1Change} label="主属性:" />
          <TypeSelect value={types[1]} onChange={handleType2Change} label="副属性:" />
        </div>
      </fieldset>

      {/* Abilities */}
      <fieldset style={{ marginBottom: 16, padding: 12 }}>
        <legend style={{ fontWeight: 'bold' }}>特性</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AbilitySelect value={abilities[0]} onChange={handleAbility1Change} label="特性1:" required />
          <AbilitySelect value={abilities[1]} onChange={handleAbility2Change} label="特性2:" />
          <AbilitySelect value={abilities[2]} onChange={handleHiddenAbilityChange} label="隐藏特性:" />
        </div>
      </fieldset>
    </div>
  );
}
