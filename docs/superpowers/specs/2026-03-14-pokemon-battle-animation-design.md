# Pokemon CLI 战斗动画系统设计

## 概述

为 Pokemon CLI 游戏设计可扩展的动画系统，支持：
- 出场动画（跳两下）
- 攻击横移动画（贝塞尔曲线）
- 受击动画
- 经典动画（蓄力、闪烁、震动等）
- 投射物动画
- 招式绑定动画数据驱动

## 架构

```
packages/battle/src/
    └── moves.js              # 招式数据，添加 animation 字段

packages/animation/           # 核心动画引擎
    └── src/index.js         # 动画系统

packages/cli/src/
    └── components/battle/
        ├── Battle.jsx        # 战斗组件
        └── animations.js     # 动画配置表
```

## 核心设计

### 1. 动画引擎 (packages/animation)

```js
// 导出内容
export class AnimationEngine {
  // 创建动画实例
  create(config)

  // 更新帧（每帧调用）
  update(deltaTime)

  // 获取当前帧的位移/效果
  getOffset()      // { x, y } 当前位移
  getEffects()     // ['shake', 'flash'] 当前效果
  isComplete()     // 是否完成

  // 支持叠加多个动画
  add(animation)
  remove(id)
}

// 贝塞尔曲线计算
export function bezier(t, p0, p1, p2, p3)

// 预定义曲线
export const CURVES = {
  'ease-in-out': [0.42, 0, 0.58, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'bounce': [0.68, -0.55, 0.265, 1.55],
}
```

### 2. 动画类型

```js
// 1. 位移动画 (Lunge)
{
  type: 'lunge',
  direction: 'forward' | 'backward' | 'left' | 'right',
  distance: 5,           // 字符宽度
  curve: 'ease-in-out',
  duration: 300,         // 毫秒
}

// 2. 跳跃动画 (Jump)
{
  type: 'jump',
  height: 2,             // 行数
  count: 2,              // 跳几次
  duration: 400,
}

// 3. 经典动画 (Classic)
{
  type: 'classic',
  effect: 'shake' | 'flash' | 'blink' | 'charge' | 'glow',
  duration: 300,
  repeat: 2,
}

// 4. 投射物 (Projectile)
{
  type: 'projectile',
  sprite: 'fireball',    // 投射物字符画
  from: 'attacker',
  to: 'target',
  speed: 8,             // 字符/帧
  curve: 'linear',
}

// 5. 序列动画 (Sequence)
{
  type: 'sequence',
  animations: [
    { type: 'charge', duration: 300 },
    { type: 'lunge', distance: 3, curve: 'ease-out' },
  ]
}

// 6. 并行动画 (Parallel)
{
  type: 'parallel',
  animations: [
    { type: 'lunge', ... },
    { type: 'classic', effect: 'flash' },
  ]
}
```

### 3. 招式动画绑定 (packages/battle)

```js
// moves.js 扩展
const MOVES = {
  'tackle': {
    id: 'tackle',
    animation: 'tackle',  // 引用 CLI 动画配置
  },
  'ember': {
    id: 'ember',
    animation: 'fire-projectile',
  },
  'thunder-shock': {
    id: 'thunder-shock',
    animation: 'electric-projectile',
  },
  'scratch': {
    id: 'scratch',
    animation: 'scratch',
  },
  // 默认动画（按属性）
  '_default': 'tackle',
  '_physical': 'tackle',
  '_special': 'projectile',
  '_status': 'charge',
};
```

### 4. CLI 动画配置表

```js
// packages/cli/src/components/battle/animations.js

export const ANIMATIONS = {
  // 基础攻击
  'tackle': {
    type: 'sequence',
    animations: [
      { type: 'lunge', direction: 'forward', distance: 4, duration: 150, curve: 'ease-out' },
      { type: 'lunge', direction: 'backward', distance: 4, duration: 150, curve: 'ease-in' },
    ]
  },
  'scratch': {
    type: 'sequence',
    animations: [
      { type: 'lunge', direction: 'forward', distance: 3, duration: 100, curve: 'ease-out' },
      { type: 'lunge', direction: 'backward', distance: 3, duration: 100, curve: 'ease-in' },
    ]
  },

  // 火系
  'fire-projectile': {
    type: 'parallel',
    animations: [
      {
        type: 'sequence',
        animations: [
          { type: 'classic', effect: 'charge', duration: 200 },
          { type: 'projectile', sprite: 'fireball', speed: 6 },
        ]
      },
      { type: 'classic', effect: 'flash', duration: 300 },
    ]
  },

  // 电系
  'electric-projectile': {
    type: 'projectile',
    sprite: 'zap',
    speed: 10,
  },

  // 水系
  'water-projectile': {
    type: 'projectile',
    sprite: 'waterball',
    speed: 6,
  },

  // 出场动画
  'entry': {
    type: 'jump',
    height: 2,
    count: 2,
    duration: 400,
  },

  // 受击动画
  'hit': {
    type: 'classic',
    effect: 'shake',
    duration: 200,
    repeat: 2,
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

// 投射物字符画
export const PROJECTILES = {
  'fireball': ['    ( ', '   (( ', '  ((* ', '   (( ', '    ) '],
  'zap': ['  +* ', ' +*+ ', '  +* '],
  'waterball': ['   ~ ', '  (~ ', '   ~ '],
};
```

### 5. 战斗组件集成

```jsx
// Battle.jsx 使用方式

// 状态
const [animations, setAnimations] = useState([]);

// 执行招式动画
const playAttackAnimation = (move) => {
  const animConfig = getAnimation(move.animation || getDefaultAnimation(move));
  const anim = animationEngine.create({
    ...animConfig,
    attacker: 'player',
    target: 'enemy',
  });
  setAnimations(prev => [...prev, anim]);
};

// 受击动画
const playHitAnimation = () => {
  const anim = animationEngine.create({
    ...ANIMATIONS.hit,
    target: 'enemy',
  });
  setAnimations(prev => [...prev, anim]);
};

// 渲染
<PokemonSprite
  pokemonId={playerMon.id}
  offset={getOffset('player')}  // 从动画获取位移
  effects={getEffects('player')} // ['shake', 'flash']
/>
```

## 实现顺序

### Phase 1: 核心动画引擎
1. AnimationEngine 类
2. 贝塞尔曲线函数
3. 基础动画类型：Lunge、Jump、Classic

### Phase 2: 战斗集成
1. 在 Battle.jsx 中集成动画
2. 出场动画（跳两下）
3. 攻击横移动画
4. 受击动画
5. 蓄力/闪烁等经典动画

### Phase 3: 扩展
1. 投射物动画
2. 序列/并行动画
3. 招式配置绑定

## 技术细节

### 帧率
- 30fps (33ms/帧)
- 使用 requestAnimationFrame 或 setInterval

### 输入阻塞
- 动画播放时设置 `inputEnabled = false`
- 动画完成后恢复

### 状态管理
- 动画状态存储在 Battle 组件的 useState
- 每个动画有唯一 ID，支持叠加

### 兼容性
- 无动画时向后兼容（直接显示结果）
- CLI 环境使用字符动画，不需要 canvas/WebGL
