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
    anim.progress = Math.min(1, anim.elapsed / anim.duration);

    if (anim.progress >= 1) {
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
