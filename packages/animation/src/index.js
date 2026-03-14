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
