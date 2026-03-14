# Pokemon CLI 战斗动画系统实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Pokemon CLI 战斗动画系统，包括出场、攻击横移、受击、经典动画

**Architecture:** 独立动画引擎包 + CLI 战斗组件集成

**Tech Stack:** React Hooks, esbuild

---

## 文件结构

```
packages/animation/              # 新建：动画引擎包
    ├── package.json
    └── src/
        └── index.js             # 动画引擎核心

packages/battle/src/
    └── moves.js                # 修改：添加 animation 字段

packages/cli/src/components/battle/
    ├── Battle.jsx              # 修改：集成动画
    ├── AnimatedSprite.jsx      # 新建：动画精灵组件
    └── animations.js           # 新建：动画配置表
```

---

## 实现计划

### Phase 1: 创建动画引擎包

#### Task 1: 创建 animation 包结构

**Files:**
- Create: `packages/animation/package.json`
- Create: `packages/animation/src/index.js`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@pokemon/animation",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "dependencies": {}
}
```

- [ ] **Step 2: 创建 src/index.js 基础框架**

```js
// packages/animation/src/index.js

// 贝塞尔曲线计算 (三次贝塞尔)
export function bezier(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

// 预定义曲线
export const CURVES = {
  'linear': [0, 0, 1, 1],
  'ease': [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  'bounce': [0.68, -0.55, 0.265, 1.55],
};

// 获取曲线点
export function getCurve(name) {
  return CURVES[name] || CURVES['ease-in-out'];
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/animation/
git commit -m "feat(animation): add animation package structure"
```

---

#### Task 2: 实现 AnimationEngine 类

**Files:**
- Modify: `packages/animation/src/index.js`

- [ ] **Step 1: 添加动画引擎类框架**

在 `packages/animation/src/index.js` 末尾添加：

```js
export class AnimationEngine {
  constructor() {
    this.animations = new Map();
    this.nextId = 0;
  }

  create(config) {
    const id = ++this.nextId;
    const animation = {
      id,
      ...config,
      startTime: Date.now(),
      elapsed: 0,
      complete: false,
    };
    this.animations.set(id, animation);
    return id;
  }

  update(id, deltaTime) {
    const anim = this.animations.get(id);
    if (!anim || anim.complete) return anim;

    anim.elapsed += deltaTime;
    const progress = Math.min(1, anim.elapsed / anim.duration);

    if (progress >= 1) {
      anim.complete = true;
    }

    return anim;
  }

  remove(id) {
    this.animations.delete(id);
  }

  isComplete(id) {
    const anim = this.animations.get(id);
    return !anim || anim.complete;
  }
}

// 单例
export const animationEngine = new AnimationEngine();
```

- [ ] **Step 2: Commit**

```bash
git add packages/animation/src/index.js
git commit -m "feat(animation): add AnimationEngine class"
```

---

#### Task 3: 实现基础动画类型

**Files:**
- Modify: `packages/animation/src/index.js`

- [ ] **Step 1: 添加 getOffset 方法计算位移**

在 AnimationEngine 类中添加方法：

```js
  // 获取位移
  getOffset(id) {
    const anim = this.animations.get(id);
    if (!anim) return { x: 0, y: 0 };

    const { type, direction, distance = 3, curve = 'ease-in-out', progress: rawProgress } = anim;
    const progress = Math.min(1, rawProgress);
    const t = bezier(progress, ...getCurve(curve));

    if (type === 'lunge') {
      const { return: shouldReturn = true } = anim;
      let lungeT;
      let lungeDist;

      if (shouldReturn) {
        // 前进然后后退（前半程前进，后半程后退）
        const forward = progress < 0.5;
        lungeT = forward ? progress * 2 : (1 - progress) * 2;
        lungeDist = bezier(lungeT, ...getCurve(curve)) * distance;
      } else {
        // 只前进不后退
        lungeDist = bezier(progress, ...getCurve(curve)) * distance;
      }

      switch (direction) {
        case 'forward': return { x: lungeDist, y: 0 };
        case 'backward': return { x: -lungeDist, y: 0 };
        case 'left': return { x: 0, y: lungeDist };
        case 'right': return { x: 0, y: -lungeDist };
        default: return { x: lungeDist, y: 0 };
      }
    }

    if (type === 'jump') {
      // 上下跳跃
      const jumpProgress = (anim.elapsed % (anim.duration / anim.count)) / (anim.duration / anim.count);
      const height = anim.height || 2;
      const y = Math.abs(Math.sin(jumpProgress * Math.PI * anim.count)) * height;
      return { x: 0, y: -y };
    }

    return { x: 0, y: 0 };
  }

  // 获取效果
  getEffects(id) {
    const anim = this.animations.get(id);
    if (!anim) return [];

    const { type, effect, progress } = anim;

    if (type === 'classic' && effect) {
      // 闪烁/震动效果
      if (effect === 'shake' || effect === 'flash') {
        const cycleDuration = 100;
        const cycle = Math.floor(anim.elapsed / cycleDuration) % 2;
        return cycle === 0 ? [effect] : [];
      }
      if (effect === 'charge' || effect === 'glow') {
        return progress < 1 ? [effect] : [];
      }
    }

    return [];
  }
```

更新 update 方法中的 progress 计算：

```js
  update(id, deltaTime) {
    const anim = this.animations.get(id);
    if (!anim || anim.complete) return anim;

    anim.elapsed += deltaTime;
    anim.progress = Math.min(1, anim.elapsed / anim.duration);

    if (anim.progress >= 1) {
      anim.complete = true;
    }

    return anim;
  }
```

- [ ] **Step 2: Commit**

```bash
git add packages/animation/src/index.js
git commit -m "feat(animation): add lunge and jump animation types"
```

---

### Phase 2: CLI 战斗集成

#### Task 4: 创建动画配置表

**Files:**
- Create: `packages/cli/src/components/battle/animations.js`

- [ ] **Step 1: 创建动画配置表**

```js
// packages/cli/src/components/battle/animations.js

// 基础动画配置
export const ANIMATIONS = {
  // 出场动画 - 跳两下
  'entry': {
    type: 'jump',
    height: 1,
    count: 2,
    duration: 500,
  },

  // 基础攻击 - 向前冲再返回（tackle 风格）
  'tackle': {
    type: 'lunge',
    direction: 'forward',
    distance: 4,
    duration: 300,
    curve: 'ease-out',
    return: true,  // 攻击后返回原位
  },

  // 抓
  'scratch': {
    type: 'lunge',
    direction: 'forward',
    distance: 3,
    duration: 200,
    curve: 'ease-out',
  },

  // 火系攻击
  'ember': {
    type: 'lunge',
    direction: 'forward',
    distance: 3,
    duration: 250,
    curve: 'ease-out',
  },

  // 水系攻击
  'water-gun': {
    type: 'lunge',
    direction: 'forward',
    distance: 3,
    duration: 250,
    curve: 'ease-out',
  },

  // 电系攻击
  'thunder-shock': {
    type: 'lunge',
    direction: 'forward',
    distance: 3,
    duration: 250,
    curve: 'ease-out',
  },

  // 受击动画
  'hit': {
    type: 'classic',
    effect: 'shake',
    duration: 400,
  },

  // 蓄力
  'charge': {
    type: 'classic',
    effect: 'charge',
    duration: 500,
  },

  // 闪烁
  'flash': {
    type: 'classic',
    effect: 'flash',
    duration: 300,
  },
};

// 默认动画映射
export const DEFAULT_ANIMATIONS = {
  'Physical': 'tackle',
  'Special': 'ember',
  'Status': 'charge',
};

// 获取动画配置
export function getAnimationConfig(moveName, category) {
  const lowerName = moveName.toLowerCase().replace(/[^a-z]/g, '');
  return ANIMATIONS[lowerName] || ANIMATIONS[DEFAULT_ANIMATIONS[category]] || ANIMATIONS.tackle;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/components/battle/animations.js
git commit -m "feat(battle): add animation config"
```

---

#### Task 5: 创建 AnimatedSprite 组件

**Files:**
- Create: `packages/cli/src/components/battle/AnimatedSprite.jsx`

- [ ] **Step 1: 创建 AnimatedSprite 组件（使用 setInterval）**

```jsx
// packages/cli/src/components/battle/AnimatedSprite.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import PokemonSprite from '../PokemonSprite.jsx';

const AnimatedSprite = ({
  pokemonId,
  pokemonType = 'normal',
  width = 20,
  height = 10,
  variant = 'front',
  showBorder = true,
  label,
  animation = null,
  effects = []
}) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [flash, setFlash] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!animation) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    // 使用 setInterval 替代 requestAnimationFrame（兼容 CLI 环境）
    intervalRef.current = setInterval(() => {
      const { getOffset, getEffects, isComplete, update } = animation;

      if (isComplete()) {
        setOffset({ x: 0, y: 0 });
        setFlash(false);
        clearInterval(intervalRef.current);
        return;
      }

      // 更新动画 (33ms = 30fps)
      update(33);

      // 获取当前状态
      const newOffset = getOffset();
      const newEffects = getEffects();

      setOffset(newOffset);
      setFlash(newEffects.includes('flash'));
    }, 33);

    // 清理函数：组件卸载或 animation 变化时清除 interval
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [animation]);

  return (
    <Box
      position="relative"
      flexDirection="column"
      minWidth={width}
      minHeight={height}
    >
      <Box
        position="absolute"
        top={offset.y}
        left={offset.x}
      >
        <Box opacity={flash ? 0.5 : 1}>
          <PokemonSprite
            pokemonId={pokemonId}
            pokemonType={pokemonType}
            width={width}
            height={height}
            variant={variant}
            showBorder={showBorder}
            label={label}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default AnimatedSprite;
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/components/battle/AnimatedSprite.jsx
git commit -m "feat(battle): add AnimatedSprite component"
```

---

#### Task 6: 修改 Battle.jsx 集成动画

**Files:**
- Modify: `packages/cli/src/components/Battle.jsx`
- Modify: `packages/cli/build.mjs` (添加 alias)

- [ ] **Step 1: 在 build.mjs 添加 animation 包别名**

```js
alias: {
  '@pokemon/i18n': resolve(__dirname, '../i18n/src/index.js'),
  '@pokemon/core': resolve(__dirname, '../core/src/types.js'),
  '@pokemon/battle': resolve(__dirname, '../battle/src/index.js'),
  '@pokemon/animation': resolve(__dirname, '../animation/src/index.js'),
},
```

- [ ] **Step 2: 修改 Battle.jsx 添加动画状态和逻辑**

在 import 部分添加：

```js
import { animationEngine } from '@pokemon/animation';
import { ANIMATIONS, getAnimationConfig } from './battle/animations.js';
import AnimatedSprite from './battle/AnimatedSprite.jsx';
```

添加动画状态：

```js
const [playerAnim, setPlayerAnim] = useState(null);
const [enemyAnim, setEnemyAnim] = useState(null);
const [inputBlocked, setInputBlocked] = useState(false);
```

修改 executeMove 函数添加动画：

```js
const executeMove = async moveIdx => {
  if (!enemyMon || phase !== PHASE.SELECT) return;
  setInputBlocked(true);  // 阻塞输入

  const pCopy = structuredClone(playerMon);
  const eCopy = structuredClone(enemyMon);
  const playerMove = pCopy.moves[moveIdx];
  if (!playerMove) { setPhase(PHASE.SELECT); setInputBlocked(false); return; }

  // 玩家攻击动画
  const animConfig = getAnimationConfig(playerMove.name, playerMove.category);
  const playerAnimId = animationEngine.create({
    ...animConfig,
    type: animConfig.type || 'lunge',
    direction: 'forward',
    duration: animConfig.duration || 300,
  });
  setPlayerAnim({ id: playerAnimId, engine: animationEngine });

  // 等待攻击动画完成
  await new Promise(r => setTimeout(r, animConfig.duration || 300));

  // 执行战斗逻辑
  const enemyMove = wildChooseMove(eCopy);
  const nameMap = {[pCopy.uid]: pCopy.nameEn, [eCopy.uid]: eCopy.nameEn};
  const events = executeTurn(pCopy, playerMove, eCopy, enemyMove);

  for (const event of events) {
    const lines = eventToLog(event, nameMap);
    if (lines.length) addLines(lines);
    setPlayerMon({...pCopy});
    setEnemyMon({...eCopy});

    // 如果造成伤害，播放受击动画
    if (event.type === 'damage') {
      const hitAnimId = animationEngine.create({
        type: 'classic',
        effect: 'shake',
        duration: 200,
      });
      setEnemyAnim({ id: hitAnimId, engine: animationEngine });
      await new Promise(r => setTimeout(r, 200));
    }

    await delay(400);
  }

  // 清理动画
  if (playerAnim?.id) animationEngine.remove(playerAnim.id);
  if (enemyAnim?.id) animationEngine.remove(enemyAnim.id);
  setPlayerAnim(null);
  setEnemyAnim(null);
  setInputBlocked(false);

  if (eCopy.hp <= 0) { addLines([`${eCopy.nameEn} 倒下了!`, '战斗胜利!`)]); setPhase(PHASE.WIN); }
  else if (pCopy.hp <= 0) { addLines([`${pCopy.nameEn} 倒下了!`, '你输了...']); setPhase(PHASE.LOSE); }
  else setPhase(PHASE.SELECT);
};
```

修改 useInput 添加输入阻塞检查：

```js
useInput((input, key) => {
  if (inputBlocked || phase !== PHASE.SELECT) return;
  // ... 现有逻辑
});
```

替换 PokemonSprite 为 AnimatedSprite：

```jsx
// 在战斗界面中
<AnimatedSprite pokemonId={enemyMon.id} pokemonType={enemyMon.type} width={20} height={10} variant="front" showBorder={false} animation={enemyAnim} />

<AnimatedSprite pokemonId={playerMon.id} pokemonType={playerMon.type} width={20} height={10} variant="back" showBorder={false} animation={playerAnim} />
```

- [ ] **Step 3: Commit**

```bash
git add packages/cli/build.mjs packages/cli/src/components/Battle.jsx
git commit -m "feat(battle): integrate animation system"
```

---

### Phase 3: 添加出场动画

**Files:**
- Modify: `packages/cli/src/components/Battle.jsx`

- [ ] **Step 1: 在 APPEAR 阶段添加出场动画**

在 enemyAppear 动画完成后，添加出场动画：

```js
useEffect(() => {
  if (phase === PHASE.APPEAR) {
    const t = setInterval(() => {
      setEnemyAppear(a => {
        if (a >= 1) {
          clearInterval(t);
          // 添加出场动画
          const entryAnimId = animationEngine.create({
            type: 'jump',
            height: 1,
            count: 2,
            duration: 400,
          });
          setEnemyAnim({ id: entryAnimId, engine: animationEngine });
          setTimeout(() => {
            setPhase(PHASE.SELECT);
            addLines(['野生的 ' + enemyMon?.nameEn + ' 出现了!']);
            if (entryAnimId) animationEngine.remove(entryAnimId);
            setEnemyAnim(null);
          }, 400);
          return 1;
        }
        return a + 0.1;
      });
    }, 40);
    return () => clearInterval(t);
  }
}, [phase]);
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/components/Battle.jsx
git commit -m "feat(battle): add entry animation"
```

---

## 验证步骤

### 测试动画系统

1. 运行 `pnpm cli:dev`
2. 开始新游戏或继续
3. 移动遇到野生宝可梦
4. 验证出场动画（跳两下）
5. 选择招式攻击
6. 验证攻击动画（向前冲）
7. 验证受击动画（敌人震动）

### 预期行为

- 动画播放时无法输入
- 动画结束后自动继续
- 向后兼容：无动画时正常工作

---

## 完成标准

- [ ] 动画引擎包创建完成
- [ ] 基础动画类型（lunge, jump, classic）工作正常
- [ ] 出场动画（跳两下）工作正常
- [ ] 攻击动画（横移）工作正常
- [ ] 受击动画（震动）工作正常
- [ ] 输入阻塞正常工作
- [ ] 向后兼容（无动画时正常）
