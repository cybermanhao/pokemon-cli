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
      duration: config.duration || 1000, // default 1 second
      startTime: Date.now(),
      elapsed: 0,
      progress: 0,
      complete: false,
    };
    this.animations.set(id, animation);
    return id;
  }

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

  remove(id) {
    this.animations.delete(id);
  }

  // Call this periodically to clean up
  cleanup() {
    for (const [id, anim] of this.animations) {
      if (anim.complete) {
        this.animations.delete(id);
      }
    }
  }

  isComplete(id) {
    const anim = this.animations.get(id);
    return !anim || anim.complete;
  }

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
}

// 单例
export const animationEngine = new AnimationEngine();
