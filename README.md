# Pokemon CLI

终端里的宝可梦游戏。基于 React + Ink 构建，使用真实战斗数据。

```
╔══════════════════════════════════════╗
║  Rattata  Lv.4          HP ██░░░░░░  ║
║                                      ║
║         /\  /\                       ║
║        ( o  o)   ← ASCII 精灵        ║
║         \  ~/                        ║
║          \/\/                        ║
║                                      ║
║  要怎么做?                            ║
║  ▶ 撞击    尾巴摇摆                  ║
║    快速攻击  抓                       ║
╚══════════════════════════════════════╝
```

## 特性

- 回合制战斗，Gen 9 数据（伤害公式 / 属性克制 / 技能数据全部真实）
- ASCII 精灵图，从 PokéAPI 自动下载并本地缓存
- 出场动画、攻击横移动画、受击动画
- 状态效果：灼伤、麻痹、睡眠、冰冻、中毒
- 探索地图，随机遇敌
- 多语言支持（中文 / English）
- 存档至 `~/.pokemon-cli/save.json`

## 快速开始

**依赖**：Node.js ≥ 18、pnpm ≥ 8

```bash
git clone <repo>
cd poke
pnpm install
pnpm cli:dev     # 构建 + 启动（热重载）
```

首次启动会从 PokéAPI 下载精灵图，需要网络。之后离线可用（数据本地缓存）。

## 脚本

| 命令 | 说明 |
|------|------|
| `pnpm cli` | 生产模式启动 |
| `pnpm cli:dev` | 开发模式（热重载 + 文件日志） |
| `pnpm cli:build` | 仅构建 |
| `pnpm cli:devtools` | 启动并连接 React DevTools |

## 项目结构

```
packages/
├── animation/     动画引擎（贝塞尔曲线，lunge / jump / classic）
├── battle/        战斗逻辑（伤害计算、AI、数据层）
│   ├── src/
│   │   ├── dex.js      数据接口，封装 @pkmn/dex
│   │   ├── engine.js   伤害计算，封装 @smogon/calc
│   │   ├── ai.js       野生宝可梦 AI 和回合执行
│   │   └── mod.js      ← 自定义扩展入口
├── cli/           主程序（Ink + React）
│   └── src/
│       ├── app.jsx              屏幕状态机
│       ├── components/
│       │   ├── Battle.jsx       战斗界面
│       │   ├── StarterSelect.jsx 选择初始宝可梦
│       │   ├── Explore.jsx      探索地图
│       │   └── battle/
│       │       ├── AnimatedSprite.jsx
│       │       └── animations.js  技能动画配置
│       ├── hooks/
│       │   └── useAsciiSprite.js  精灵图加载 Hook
│       ├── store/
│       │   └── gameState.js    游戏状态 + 存档
│       └── utils/
│           ├── ascii-sprite.js  PNG → ASCII 转换
│           └── debug.js         调试日志工具
├── core/          基础类型定义（待整合）
├── i18n/          国际化（中文 / English）
├── editor/        Tauri 编辑器（开发中）
└── maze/          迷宫生成（开发中）
```

## 技术栈

| 层 | 技术 |
|----|------|
| UI | [Ink](https://github.com/vadimdemedes/ink) — React for CLIs |
| 战斗数据 | [@pkmn/dex](https://github.com/pkmn/ps/tree/main/dex) — Pokemon Showdown 数据层 |
| 伤害计算 | [@smogon/calc](https://github.com/smogon/damage-calc) — Smogon 精确伤害计算器 |
| 图像处理 | [Jimp](https://github.com/jimp-dev/jimp) — PNG 转 ASCII |
| 构建 | esbuild |
| 包管理 | pnpm workspace（Monorepo） |

## 数据扩展

在 `packages/battle/src/mod.js` 中添加自定义精灵、技能、道具，无需修改其他代码：

```js
// packages/battle/src/mod.js
export const MOD_DATA = {

  // 修改现有精灵（inherit: true 继承原有数据）
  Species: {
    'Pikachu': {
      inherit: true,
      baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 120 }
    }
  },

  // 添加全新精灵（num >= 10000 避开官方编号）
  // Species: {
  //   'MyPokemon': {
  //     num: 10001, name: 'MyPokemon',
  //     types: ['Fire', 'Dragon'],
  //     baseStats: { hp: 80, atk: 100, def: 70, spa: 90, spd: 70, spe: 95 },
  //     abilities: { '0': 'Blaze' }
  //   }
  // },

  // 添加自定义技能
  // Moves: {
  //   'CustomFlame': {
  //     num: 10001, name: 'Custom Flame',
  //     type: 'Fire', category: 'Special',
  //     basePower: 100, accuracy: 90, pp: 5
  //   }
  // },
};
```

切换战斗世代：修改 `packages/battle/src/dex.js` 顶部的 `BATTLE_GEN`。

## 调试

**文件日志**（推荐，随时可用）：

```bash
pnpm cli:dev    # DEBUG=1 已内置

# Windows PowerShell（另开终端）
Get-Content $env:USERPROFILE\.pokemon-cli\debug.log -Wait

# Git Bash / WSL
tail -f ~/.pokemon-cli/debug.log
```

在代码里写日志：

```js
import { debug, debugClear } from '../utils/debug.js';

debugClear();  // 清空本次日志
debug('executeMove', moveIdx, { phase, animId });
```

**React DevTools**（调试组件状态）：

```bash
pnpm cli:devtools    # 终端 1
npx react-devtools  # 终端 2，打开 GUI 后自动连接
```

## 开发路线

- [x] 基础战斗系统（Gen 9 数据）
- [x] ASCII 精灵图 + 缓存
- [x] 战斗动画（出场 / 攻击 / 受击）
- [x] 状态效果（灼伤 / 麻痹 / 睡眠 / 冰冻 / 中毒）
- [x] Mod 扩展接口
- [ ] 捕捉系统
- [ ] 队伍管理
- [ ] 城市地图 + 训练馆
- [ ] 训练师对战 AI
- [ ] 商店 / 道具
- [ ] 迷宫探索
- [ ] Tauri 编辑器
