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
  const lowerName = moveName.toLowerCase().replace(/\s+/g, '-');
  return ANIMATIONS[lowerName] || ANIMATIONS[DEFAULT_ANIMATIONS[category]] || ANIMATIONS.tackle;
}
