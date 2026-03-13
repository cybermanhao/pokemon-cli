# Pokemon CLI - 项目初始化实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Monorepo 项目结构，安装依赖，验证 CLI 和编辑器基础框架可用

**Architecture:** 使用 pnpm workspace 管理 Monorepo，cli 使用 create-ink-app 初始化，editor 使用 create-tauri-app 初始化

**Tech Stack:** pnpm, Ink, React, Tauri

---

## 文件结构

```
pokemon/
├── pnpm-workspace.yaml          # Monorepo 配置
├── package.json                 # 根 package.json
├── packages/
│   ├── cli/                     # CLI 应用
│   │   ├── package.json
│   │   ├── cli.js
│   │   └── src/
│   │       ├── index.jsx
│   │       └── app.jsx
│   ├── editor/                  # Tauri 编辑器
│   │   ├── package.json
│   │   ├── src/
│   │   │   └── main.jsx
│   │   └── src-tauri/
│   │       ├── Cargo.toml
│   │       ├── tauri.conf.json
│   │       └── src/
│   │           └── main.rs
│   ├── core/                    # 核心库
│   │   ├── package.json
│   │   └── src/
│   │       └── index.js
│   ├── i18n/                    # 国际化
│   │   ├── package.json
│   │   └── src/
│   │       └── index.js
│   └── maze/                    # 迷宫生成
│       ├── package.json
│       └── src/
│           └── index.js
└── tsconfig.json                 # TypeScript 配置（共享）
```

---

## Chunk 1: 创建 Monorepo 基础结构

### Task 1: 创建根目录配置文件

**Files:**
- Create: `C:/code/poke/pnpm-workspace.yaml`
- Create: `C:/code/poke/package.json`
- Create: `C:/code/poke/tsconfig.json`

- [ ] **Step 1: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 2: 创建根 package.json**

```json
{
  "name": "pokemon-cli",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "cli": "pnpm --filter cli start",
    "editor": "pnpm --filter editor dev"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: 初始化 git**

```bash
cd C:/code/poke
git init
git add .
git commit -m "chore: init monorepo structure"
```

---

### Task 2: 创建 core 包

**Files:**
- Create: `C:/code/poke/packages/core/package.json`
- Create: `C:/code/poke/packages/core/src/index.js`
- Create: `C:/code/poke/packages/core/src/types.js`

- [ ] **Step 1: 创建 core/package.json**

```json
{
  "name": "@pokemon/core",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js",
    "./types": "./src/types.js"
  },
  "dependencies": {}
}
```

- [ ] **Step 2: 创建基础类型定义**

```javascript
// src/types.js

// 属性类型
export const TYPES = {
  NORMAL: 'normal',
  FIRE: 'fire',
  WATER: 'water',
  ELECTRIC: 'electric',
  GRASS: 'grass',
  ICE: 'ice',
  FIGHTING: 'fighting',
  POISON: 'poison',
  GROUND: 'ground',
  FLYING: 'flying',
  PSYCHIC: 'psychic',
  BUG: 'bug',
  ROCK: 'rock',
  GHOST: 'ghost',
  DRAGON: 'dragon',
  DARK: 'dark',
  STEEL: 'steel',
  FAIRY: 'fairy',
};

// 宝可梦基础数据
export class Pokemon {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.types = data.types || [];
    this.stats = {
      hp: data.stats?.hp || 0,
      attack: data.stats?.attack || 0,
      defense: data.stats?.defense || 0,
      specialAttack: data.stats?.specialAttack || 0,
      specialDefense: data.stats?.specialDefense || 0,
      speed: data.stats?.speed || 0,
    };
    this.moves = data.moves || [];
    this.sprites = data.sprites || {};
    this.ascii = data.ascii || null;
  }
}

// 技能
export class Move {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.power = data.power || 0;
    this.accuracy = data.accuracy || 100;
    this.pp = data.pp || 20;
    this.maxPp = data.maxPp || data.pp || 20;
    this.category = data.category || 'physical'; // physical, special, status
  }
}

// 物品
export class Item {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description || '';
    this.type = data.type || 'general'; // pokeball, medicine, key
    this.price = data.price || 0;
  }
}

// 玩家
export class Player {
  constructor() {
    this.name = 'Player';
    this.money = 1000;
    this.team = [];
    this.pc = [];
    this.bag = [];
    this.pokedex = {};
    this.currentCity = 'start';
  }
}
```

- [ ] **Step 3: 创建 core/src/index.js**

```javascript
export * from './types.js';
```

- [ ] **Step 4: 提交 core 包**

```bash
git add packages/core/
git commit -m "feat(core): add core package with base types"
```

---

### Task 3: 创建 CLI 应用 (Ink)

**Files:**
- Create: `C:/code/poke/packages/cli/package.json`
- Create: `C:/code/poke/packages/cli/cli.js`
- Create: `C:/code/poke/packages/cli/src/app.jsx`
- Create: `C:/code/poke/packages/cli/src/components/title.jsx`

- [ ] **Step 1: 创建 cli/package.json**

```json
{
  "name": "@pokemon/cli",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "pokemon": "./cli.js"
  },
  "dependencies": {
    "ink": "^6.0.0",
    "react": "^18.2.0",
    "@pokemon/core": "workspace:*"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: 创建 cli.js 入口**

```javascript
#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import App from './src/app.jsx';

render(<App />);
```

- [ ] **Step 3: 创建基础 App 组件**

```jsx
// src/app.jsx
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TitleScreen from './components/title.jsx';

const App = () => {
  const [screen, setScreen] = useState('title'); // title, menu, battle, explore

  return (
    <Box flexDirection="column">
      {screen === 'title' && <TitleScreen onStart={() => setScreen('menu')} />}
      {screen === 'menu' && (
        <Box>
          <Text>Game Menu</Text>
        </Box>
      )}
    </Box>
  );
};

export default App;
```

- [ ] **Step 4: 创建标题画面组件**

```jsx
// src/components/title.jsx
import React from 'react';
import { Box, Text } from 'ink';

const TitleScreen = ({ onStart }) => {
  return (
    <Box flexDirection="column" alignItems="center" padding={2}>
      <Text bold color="cyan">
        POKEMON CLI
      </Text>
      <Text color="yellow">Press any key to start...</Text>
    </Box>
  );
};

export default TitleScreen;
```

- [ ] **Step 5: 安装依赖并测试**

```bash
cd C:/code/poke
npm install -g pnpm
pnpm install
```

- [ ] **Step 6: 提交 CLI 基础**

```bash
git add packages/cli/
git commit -m "feat(cli): add ink cli app with title screen"
```

---

### Task 4: 创建 Tauri 编辑器基础

**Files:**
- Create: `C:/code/poke/packages/editor/package.json`
- Create: `C:/code/poke/packages/editor/vite.config.js`
- Create: `C:/code/poke/packages/editor/index.html`
- Create: `C:/code/poke/packages/editor/src/main.jsx`
- Create: `C:/code/poke/packages/editor/src-tauri/Cargo.toml`
- Create: `C:/code/poke/packages/editor/src-tauri/tauri.conf.json`
- Create: `C:/code/poke/packages/editor/src-tauri/src/main.rs`
- Create: `C:/code/poke/packages/editor/src-tauri/build.rs`

- [ ] **Step 1: 创建 editor/package.json**

```json
{
  "name": "@pokemon/editor",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@tauri-apps/api": "^2.0.0",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.0"
  }
}
```

- [ ] **Step 2: 创建 vite.config.js**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
```

- [ ] **Step 3: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pokemon Editor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 创建 main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: 创建 App.jsx**

```jsx
import React from 'react';

function App() {
  return (
    <div>
      <h1>Pokemon Editor</h1>
      <p>Editor modules will go here:</p>
      <ul>
        <li>Sprite Editor</li>
        <li>Map Editor</li>
        <li>Pokedex Editor</li>
        <li>Move Editor</li>
        <li>Item Editor</li>
      </ul>
    </div>
  );
}

export default App;
```

- [ ] **Step 6: 创建 Tauri 配置**

**Cargo.toml:**
```toml
[package]
name = "pokemon-editor"
version = "1.0.0"
description = "Pokemon Editor"
authors = []
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

**tauri.conf.json:**
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Pokemon Editor",
  "identifier": "com.pokemon.editor",
  "version": "1.0.0",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "devtools": true
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "Pokemon Editor",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

> **注意**：图标文件在后续步骤中添加（可选）

**build.rs:**
```rust
fn main() {
    tauri_build::build()
}
```

**main.rs:**
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 7: 创建 Tauri v2 Capabilities 配置**

**src-tauri/capabilities/default.json:**
```json
{
  "$schema": "https://schema.tauri.app/config/2/capability",
  "identifier": "default",
  "description": "Default capabilities for Pokemon Editor",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open"
  ]
}
```

- [ ] **Step 8: 安装 pnpm 并安装依赖**

```bash
cd C:/code/poke
pnpm install
```

- [ ] **Step 9: 提交编辑器基础**

```bash
git add packages/editor/
git commit -m "feat(editor): add tauri editor app base"
```

---

### Task 5: 创建 i18n 和 maze 空包

**Files:**
- Create: `C:/code/poke/packages/i18n/package.json`
- Create: `C:/code/poke/packages/i18n/src/index.js`
- Create: `C:/code/poke/packages/maze/package.json`
- Create: `C:/code/poke/packages/maze/src/index.js`

- [ ] **Step 1: 创建 i18n 空包**

```json
{
  "name": "@pokemon/i18n",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js"
  }
}
```

```javascript
// src/index.js
export const i18n = {
  // To be implemented
};

export default i18n;
```

- [ ] **Step 2: 创建 maze 空包**

```json
{
  "name": "@pokemon/maze",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js"
  }
}
```

```javascript
// src/index.js
// To be implemented with simplex-noise

export const generateMaze = (seed, width, height) => {
  // Placeholder
  return [];
};

export default { generateMaze };
```

- [ ] **Step 3: 提交空包**

```bash
git add packages/i18n/ packages/maze/
git commit -m "feat: add i18n and maze packages (placeholder)"
```

---

## Chunk 2: 验证开发环境

### Task 6: 验证 CLI 运行

- [ ] **Step 1: 验证 CLI 启动**

```bash
cd C:/code/poke/packages/cli
# 应该能启动 Ink 应用，显示标题画面
# Ctrl+C 退出
```

- [ ] **Step 2: 验证编辑器构建**

```bash
cd C:/code/poke/packages/editor
npm run build
# 应该能构建成功
```

- [ ] **Step 3: 最终提交**

```bash
git add .
git commit -m "chore: verify dev environment"
```

---

## 验证清单

- [ ] pnpm workspace 正常工作
- [ ] `pnpm cli` 启动 Ink 应用
- [ ] `pnpm editor` 启动 Tauri 编辑器
- [ ] 所有包的依赖正确安装
- [ ] core 包可被 cli 正确引用

---

**Plan complete and saved to `docs/superpowers/plans/2026-03-13-pokemon-cli-init-plan.md`. Ready to execute?**
