/**
 * Combine a base world position (x, y, z) with the model's normalized offset from SceneConfig.
 * Returns a tuple ready to spread into `new Vector3(...normalOffset(...))`.
 */
export function normalOffset(
  x: number,
  y: number,
  z: number,
  sceneOffset: [number, number, number]
): [number, number, number] {
  return [x + sceneOffset[0], y + sceneOffset[1], z + sceneOffset[2]]
}

/**
 * Combine a placement scale with the model's normalized scale from SceneConfig.
 * Use `normalScale(1, cfg.scale)` for a uniformly-scaled model,
 * or `normalScale(perInstanceScale, cfg.scale)` for per-instance variation (e.g. plants).
 */
export function normalScale(scale: number, sceneScale: number): number {
  return scale * sceneScale
}

/**
 * Combine a placement Y-axis rotation with the model's normalized angle from SceneConfig.
 * Use `normalAngle(0, cfg.angle)` when the placement has no extra rotation.
 */
export function normalAngle(angle: number, sceneAngle: number): number {
  return angle + sceneAngle
}
