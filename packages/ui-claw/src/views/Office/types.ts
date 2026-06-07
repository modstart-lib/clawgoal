export interface MeshEntity {
  name: string
  /** Whether this sprite is enabled; use to filter active models when multiple are configured */
  enable: boolean
  /** original file key, kept for reference */
  file: string
  /** Vite-resolved URL (hashed in production). Optional — load.ts resolves URLs lazily at runtime. */
  url?: string
  /** Manual set, placement scale factor to apply to the model (in addition to any per-instance variation) */
  scale: number
  /** Manual set, Y-axis rotation */
  angle: number
  /** Manual set, box container scale, default 1,1,1 */
  boxScale: [number, number, number]

  /**
   * AFTER scale+angle :
   * Centering offset [x, y, z]. After applying scale → angle → offset the model's
   * bounding-box center sits exactly at world origin (all three axes).
   * offset = [-rotated_center_X, -center_Y, -rotated_center_Z]
   */
  offset: [number, number, number]
  /**
   * The Y value to pass as `py` to `normalOffset(px, py, pz, cfg.offset)` so that
   * the model's lowest point sits at world Y = 0 (on the floor).
   * Formula: groundOffset = -local_Y_bottom - offset[1]
   * where local_Y_bottom is the scaled bounding-box bottom in local space.
   */
  groundOffset: number
  /**
   * AFTER scale+angle :
   * World-space footprint width (X axis) after applying scale + Y-axis rotation.
   * Computed as: |cos(angle)| × scaledSizeX + |sin(angle)| × scaledSizeZ.
   * Used for collision detection and walkable-grid obstacle exclusion.
   */
  width: number
  /**
   * AFTER scale+angle :
   * World-space footprint depth (Z axis) after applying scale + Y-axis rotation.
   * Computed as: |sin(angle)| × scaledSizeX + |cos(angle)| × scaledSizeZ.
   * Used for collision detection and walkable-grid obstacle exclusion.
   */
  depth: number
  /**
   * World-space height (Y axis) after applying scale.
   * Y-axis rotation has no effect on height.
   * Used for hitbox creation and collision detection.
   * Auto-computed by scripts/sync-mesh.mjs.
   */
  height: number

  /**
   * List of all animation names available in the model, in "NodeName|AnimationName" format.
   */
  animationsAll: { name: string }[]

  /**
   * Mapping of animation categories (idle, working, handup, walk, play) to specific animation names in the model.
   * - idle, working, handup, walk: single-element arrays
   * - play: one or more random idle animations played when not walking and away from the desk
   */
  animations: {
    idle?: { name: string }[]
    working?: { name: string }[]
    handup?: { name: string }[]
    walk?: { name: string }[]
    play?: { name: string }[]
    [animationName: string]: { name: string }[] | undefined
  }
}

export interface MeshesConfig {
  desktop: MeshEntity
  printer: MeshEntity
  bookshelf?: MeshEntity
  fridge?: MeshEntity
  boards: MeshEntity[]
  plant: MeshEntity
  sofa: MeshEntity
}

// ─── 场景碰撞体注册表类型 ────────────────────────────────────────────────
export type MaterialType =
  | 'desk'
  | 'board'
  | 'plant'
  | 'printer'
  | 'sofa'
  | 'bookshelf'
  | 'fridge'

export interface SceneMaterial {
  id: string
  type: MaterialType
  x: number
  z: number
  width: number
  depth: number
  boxScale?: [number, number, number]
  angle?: number
  scaleMultiplier?: number
}
