import React, { useState, useCallback } from 'react';
import { fetchSpritePng, renderAsciiNative, renderAsciiSidecar } from '../../lib/ipc';

const ENGINES = [
  { id: 'native', name: 'Native (Rust)', description: 'Built-in brightness + Braille' },
  { id: 'jimp', name: 'Jimp', description: 'Node.js jimp library' },
  { id: 'chafa', name: 'Chafa', description: 'Terminal image renderer (requires chafa binary)' },
  { id: 'jp2a', name: 'JP2A', description: 'JPG to ASCII (requires jp2a binary)' },
];

const CHARSETS = [
  { id: 'simple', name: 'Simple', chars: ' .:+*#@' },
  { id: 'dense', name: 'Dense', chars: ' .:-=+*#%@' },
  { id: 'blocks', name: 'Blocks', chars: ' ░▒▓█' },
];

export default function SpriteStudio() {
  const [speciesId, setSpeciesId] = useState('25');
  const [variant, setVariant] = useState('front');
  const [loading, setLoading] = useState(false);
  const [pngPath, setPngPath] = useState('');
  const [outputs, setOutputs] = useState({});
  const [config, setConfig] = useState({
    width: 32,
    charset: 'dense',
    colored: false,
    invert: false,
    contrast: 0,
  });

  const variantOptions = [
    { id: 'front', label: '正面' },
    { id: 'back', label: '背面' },
    { id: 'frontShiny', label: '闪正面' },
    { id: 'backShiny', label: '闪背面' },
  ];

  // Fetch sprite
  const handleFetch = useCallback(async () => {
    setLoading(true);
    setOutputs({});
    try {
      // variant already contains the full variant name (front, back, frontShiny, backShiny)
      const path = await fetchSpritePng(parseInt(speciesId, 10), variant);
      setPngPath(path);
    } catch (e) {
      alert(`获取失败: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [speciesId, variant]);

  // Render ASCII with all engines
  const handleRender = useCallback(async () => {
    if (!pngPath) return;
    setLoading(true);
    const results = {};

    // Native engine
    try {
      const result = await renderAsciiNative(pngPath, { ...config, charset: config.charset });
      results.native = result.join('\n');
    } catch (e) {
      results.native = `Error: ${e}`;
    }

    // Sidecar engines (jimp)
    try {
      const result = await renderAsciiSidecar('jimp', pngPath, config.width, config.charset, config.colored, config.invert, config.contrast);
      results.jimp = result;
    } catch (e) {
      results.jimp = `Error: ${e}`;
    }

    setOutputs(results);
    setLoading(false);
  }, [pngPath, config]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16 }}>
      <h2 style={{ margin: '0 0 16px 0' }}>Sprite Studio</h2>

      {/* Control panel */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>精灵编号</label>
          <input
            type="number"
            value={speciesId}
            onChange={(e) => setSpeciesId(e.target.value)}
            style={{ padding: '4px 8px', width: 80 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>形态</label>
          <select value={variant} onChange={(e) => setVariant(e.target.value)} style={{ padding: '4px 8px' }}>
            {variantOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>&nbsp;</label>
          <button onClick={handleFetch} disabled={loading}>
            {loading ? '获取中...' : '获取精灵图'}
          </button>
        </div>
      </div>

      {/* Config */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>宽度</label>
          <input
            type="number"
            value={config.width}
            onChange={(e) => setConfig({ ...config, width: parseInt(e.target.value, 10) || 32 })}
            style={{ padding: '4px 8px', width: 60 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>字符集</label>
          <select value={config.charset} onChange={(e) => setConfig({ ...config, charset: e.target.value })} style={{ padding: '4px 8px' }}>
            {CHARSETS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>&nbsp;</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={config.invert} onChange={(e) => setConfig({ ...config, invert: e.target.checked })} />
            反转
          </label>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>&nbsp;</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={config.colored} onChange={(e) => setConfig({ ...config, colored: e.target.checked })} />
            彩色
          </label>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>对比度</label>
          <input
            type="range"
            min="-50"
            max="50"
            value={config.contrast}
            onChange={(e) => setConfig({ ...config, contrast: parseInt(e.target.value, 10) })}
            style={{ width: 100 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>&nbsp;</label>
          <button onClick={handleRender} disabled={!pngPath || loading}>
            渲染 ASCII
          </button>
        </div>
      </div>

      {/* Results */}
      {pngPath && (
        <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
          PNG 路径: {pngPath}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'auto' }}>
        {Object.entries(outputs).map(([engine, output]) => (
          <div key={engine} style={{ flex: 1, minWidth: 300 }}>
            <h3 style={{ margin: '0 0 8px 0' }}>{ENGINES.find((e) => e.id === engine)?.name || engine}</h3>
            <pre style={{
              background: '#1e1e1e',
              color: '#fff',
              padding: 12,
              borderRadius: 4,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 10,
              lineHeight: 1.2,
              whiteSpace: 'pre',
            }}>
              {output}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
