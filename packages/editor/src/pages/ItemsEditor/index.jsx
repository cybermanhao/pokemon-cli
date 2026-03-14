import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

export default function ItemsEditor({ itemsRaw, setItemsRaw }) {
  const [error, setError] = useState('');

  const handleChange = (value) => {
    setItemsRaw(value || '{}');
    // Try to validate
    try {
      // This won't work for raw JS with functions, but we can at least check for basic syntax
      if (!value.includes('Items:') && !value.trim().startsWith('{')) {
        setError('警告: 未检测到 Items 对象');
      } else {
        setError('');
      }
    } catch (e) {
      setError(`语法错误: ${e.message}`);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
        <strong>道具编辑器</strong>
        <span style={{ marginLeft: 16, fontSize: 12, color: '#666' }}>
          直接编辑 JavaScript 对象字面量，支持函数回调
        </span>
      </div>
      {error && (
        <div style={{ padding: '8px 16px', background: error.includes('语法') ? '#ffebee' : '#fff3e0', color: error.includes('语法') ? '#c62828' : '#e65100' }}>
          {error}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={itemsRaw}
          onChange={handleChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}
