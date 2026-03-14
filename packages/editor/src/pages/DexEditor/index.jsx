import React, { useState, useMemo } from 'react';
import { getAllSpeciesNames, getOfficialSpecies } from '../../lib/dex';
import SpeciesList from './SpeciesList';
import SpeciesForm from './SpeciesForm';

const TYPES = [
  'Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel',
  'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy',
];

export default function DexEditor({ species, setSpecies, moves, itemsRaw }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');

  // Get all species names from official dex + custom ones
  const allNames = useMemo(() => {
    const official = getAllSpeciesNames();
    const custom = Object.keys(species);
    // Combine, prioritizing custom (override official)
    const combined = [...new Set([...custom, ...official])];
    return combined.sort();
  }, [species]);

  // Filter by search
  const filteredNames = useMemo(() => {
    if (!filter) return allNames;
    const f = filter.toLowerCase();
    return allNames.filter((n) => n.toLowerCase().includes(f));
  }, [allNames, filter]);

  // Handle adding a new species
  const handleAdd = (name) => {
    if (species[name]) {
      setSelected(name);
      return;
    }
    // Create a new species entry based on official data
    const official = getOfficialSpecies(name);
    const newSpecies = {
      name,
      num: official?.num || Object.keys(species).length + 1,
      inherit: true,
    };
    if (official?.baseStats) {
      newSpecies.baseStats = { ...official.baseStats };
    }
    if (official?.types) {
      newSpecies.types = [...official.types];
    }
    if (official?.abilities) {
      newSpecies.abilities = Array.from(official.abilities);
    }
    setSpecies({ ...species, [name]: newSpecies });
    setSelected(name);
  };

  // Handle updating a species
  const handleUpdate = (name, updates) => {
    setSpecies({ ...species, [name]: { ...species[name], ...updates } });
  };

  // Handle deleting a species
  const handleDelete = (name) => {
    const { [name]: _, ...rest } = species;
    setSpecies(rest);
    if (selected === name) setSelected(null);
  };

  // Handle forking (create copy with inherit: true)
  const handleFork = (name) => {
    const official = getOfficialSpecies(name);
    if (!official) return;
    const forkedName = `${name} (Custom)`;
    const newSpecies = {
      name: forkedName,
      num: official.num,
      inherit: true,
      baseStats: { ...official.baseStats },
      types: [...official.types],
      abilities: [...official.abilities],
    };
    setSpecies({ ...species, [forkedName]: newSpecies });
    setSelected(forkedName);
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left panel - species list */}
      <div style={{ width: 280, borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
        <SpeciesList
          names={filteredNames}
          species={species}
          selected={selected}
          onSelect={setSelected}
          onAdd={handleAdd}
          filter={filter}
          onFilterChange={setFilter}
        />
      </div>

      {/* Right panel - form */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selected && species[selected] ? (
          <SpeciesForm
            name={selected}
            data={species[selected]}
            onUpdate={(updates) => handleUpdate(selected, updates)}
            onDelete={() => handleDelete(selected)}
            onFork={() => handleFork(selected)}
            isCustom={true}
          />
        ) : selected && !species[selected] ? (
          <div style={{ padding: 20 }}>
            <p>已选择官方精灵 <strong>{selected}</strong></p>
            <button onClick={() => handleAdd(selected)}>
              添加到自定义
            </button>
          </div>
        ) : (
          <div style={{ padding: 20, color: '#666' }}>
            从左侧选择一个精灵进行编辑，或搜索添加新精灵
          </div>
        )}
      </div>
    </div>
  );
}

export { TYPES };
