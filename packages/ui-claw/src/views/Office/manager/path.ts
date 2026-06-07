import { Vector3 } from '@babylonjs/core'
import type { OfficeContext, AgentAnimState } from '../office'

// ─── 常量 ─────────────────────────────────────────────────────────────────────
export const WALK_SPEED = 3.2
export const ARRIVE_THRESHOLD = 0.5
export const GRID_STEP = 3
export const STUCK_TIMEOUT = 1.5
export const STUCK_MIN_PROGRESS = 0.8
export const URGENT_RETURN_SPEED = 2.0

const OBSTACLE_MARGIN = 0.8
const AGENT_SEPARATION_RADIUS = 6
const AGENT_SEPARATION_STRENGTH = 5.0
const AGENT_HARD_MIN_DIST = 2.2
const ROAM_NEARBY_AGENT_RADIUS = 2

// ─── 网格坐标工具 ─────────────────────────────────────────────────────────────
function wToG(w: number): number {
  return Math.round(w / GRID_STEP)
}
function gToW(g: number): number {
  return g * GRID_STEP
}
function gridKey(gx: number, gz: number): string {
  return `${gx},${gz}`
}

// ─── 碰撞检测 ─────────────────────────────────────────────────────────────────

/** 判断世界坐标点 (px, pz) 是否在任意静态障碍物 AABB 内 */
export function isInsideObstacle(
  ctx: OfficeContext,
  px: number,
  pz: number
): boolean {
  for (const mat of ctx.materials) {
    const bsx = mat.boxScale?.[0] ?? 1
    const bsz = mat.boxScale?.[2] ?? 1
    const hw = (mat.width * bsx) / 2 + OBSTACLE_MARGIN
    const hd = (mat.depth * bsz) / 2 + OBSTACLE_MARGIN
    if (Math.abs(px - mat.x) < hw && Math.abs(pz - mat.z) < hd) return true
  }
  return false
}

/** 判断 agent 是否靠近自己的桌子 */
export function isNearDesk(state: AgentAnimState): boolean {
  if (!state.meshRoot) return true
  const dx = state.meshRoot.position.x - state.deskPosition.x
  const dz = state.meshRoot.position.z - state.deskPosition.z
  return Math.sqrt(dx * dx + dz * dz) < 2.5
}

/** 判断 agent 附近是否有其他 agent（用于限制停留时长） */
export function isNearAnotherAgent(
  ctx: OfficeContext,
  state: AgentAnimState
): boolean {
  if (!state.meshRoot) return false
  let found = false
  ctx.agentAnimStates.forEach((other, otherIdx) => {
    if (found || otherIdx === state.agentIdx || !other.meshRoot) return
    const dx = state.meshRoot!.position.x - other.meshRoot.position.x
    const dz = state.meshRoot!.position.z - other.meshRoot.position.z
    if (Math.sqrt(dx * dx + dz * dz) < ROAM_NEARBY_AGENT_RADIUS) found = true
  })
  return found
}

// ─── 可行走区域构建 ───────────────────────────────────────────────────────────

/** 根据 ctx.materials 中的障碍物信息构建可行走网格，结果写入 ctx */
export function buildWalkablePoints(ctx: OfficeContext): void {
  ctx.walkablePoints = []
  ctx.walkableSet = new Set<string>()
  const WALL_MARGIN = 3
  for (let x = WALL_MARGIN; x <= ctx.floorWidth - WALL_MARGIN; x += GRID_STEP) {
    for (
      let z = WALL_MARGIN;
      z <= ctx.floorDepth - WALL_MARGIN;
      z += GRID_STEP
    ) {
      if (!isInsideObstacle(ctx, x, z)) {
        ctx.walkablePoints.push(new Vector3(x, 0, z))
        ctx.walkableSet.add(gridKey(wToG(x), wToG(z)))
      }
    }
  }
}

// ─── A* 寻路 ──────────────────────────────────────────────────────────────────

/**
 * 在可行走网格上用 A* 算法计算从 from 到 to 的路径。
 * 返回世界坐标路点数组（不含起点）。若找不到路径则直接返回 [to]。
 */
export function findPath(
  ctx: OfficeContext,
  from: Vector3,
  to: Vector3
): Vector3[] {
  const sx = wToG(from.x),
    sz = wToG(from.z)
  const ex = wToG(to.x),
    ez = wToG(to.z)
  if (sx === ex && sz === ez) return [to.clone()]

  type ANode = {
    gx: number
    gz: number
    g: number
    f: number
    parent: ANode | null
  }
  const open: ANode[] = []
  const openMap = new Map<string, ANode>()
  const closed = new Set<string>()
  const h = (gx: number, gz: number) => Math.abs(ex - gx) + Math.abs(ez - gz)
  const start: ANode = { gx: sx, gz: sz, g: 0, f: h(sx, sz), parent: null }
  open.push(start)
  openMap.set(gridKey(sx, sz), start)

  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const

  while (open.length > 0) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i
    const cur = open.splice(bi, 1)[0]
    const ck = gridKey(cur.gx, cur.gz)
    openMap.delete(ck)
    closed.add(ck)

    if (cur.gx === ex && cur.gz === ez) {
      const path: Vector3[] = []
      let node: ANode | null = cur
      while (node && node.parent) {
        path.unshift(new Vector3(gToW(node.gx), 0, gToW(node.gz)))
        node = node.parent
      }
      if (path.length > 0) path[path.length - 1] = to.clone()
      else path.push(to.clone())
      return path
    }

    for (const [dx, dz] of DIRS) {
      const nx = cur.gx + dx,
        nz = cur.gz + dz
      const nk = gridKey(nx, nz)
      if (closed.has(nk) || !ctx.walkableSet.has(nk)) continue
      const ng = cur.g + (dx !== 0 && dz !== 0 ? 1.414 : 1)
      const existing = openMap.get(nk)
      if (existing) {
        if (ng < existing.g) {
          existing.g = ng
          existing.f = ng + h(nx, nz)
          existing.parent = cur
        }
      } else {
        const nn: ANode = {
          gx: nx,
          gz: nz,
          g: ng,
          f: ng + h(nx, nz),
          parent: cur,
        }
        open.push(nn)
        openMap.set(nk, nn)
      }
    }
    if (closed.size > 8000) break
  }
  return [to.clone()]
}

/** 游走目标点选取时，排除桌子附近区域并偏向外围 */
const DESK_AVOID_RADIUS = 7

/** 随机选取一个可行走目标点，优先偏向远离桌子聚集区的外围位置 */
export function pickRoamTarget(ctx: OfficeContext): Vector3 | null {
  if (ctx.walkablePoints.length === 0) return null

  // 收集所有桌子中心
  const deskCenters = ctx.materials
    .filter((m) => m.type === 'desk')
    .map((m) => ({ x: m.x, z: m.z }))

  // 计算桌子群中心（用于外围偏权）
  let clusterX = ctx.floorWidth / 2
  let clusterZ = ctx.floorDepth / 2
  if (deskCenters.length > 0) {
    clusterX = deskCenters.reduce((s, d) => s + d.x, 0) / deskCenters.length
    clusterZ = deskCenters.reduce((s, d) => s + d.z, 0) / deskCenters.length
  }

  // 过滤掉离任意桌子过近的点
  let candidates = ctx.walkablePoints.filter((p) => {
    for (const desk of deskCenters) {
      const dx = p.x - desk.x
      const dz = p.z - desk.z
      if (dx * dx + dz * dz < DESK_AVOID_RADIUS * DESK_AVOID_RADIUS)
        return false
    }
    return true
  })
  if (candidates.length === 0) candidates = ctx.walkablePoints

  // 加权随机：距桌子群中心越远权重越高，偏向外围游走
  const weights = candidates.map((p) => {
    const dx = p.x - clusterX
    const dz = p.z - clusterZ
    return Math.sqrt(dx * dx + dz * dz) + 1
  })
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  let r = Math.random() * totalWeight
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i].clone()
  }
  return candidates[candidates.length - 1].clone()
}

// ─── 逐帧移动 ─────────────────────────────────────────────────────────────────

/**
 * 将 agent 的 meshRoot 朝 target 方向移动一帧，带障碍物滑动 + agent 软分离力。
 * 返回 true 表示已到达目标。
 */
export function moveToward(
  ctx: OfficeContext,
  state: AgentAnimState,
  target: Vector3,
  dt: number,
  speedMultiplier = 1.0
): boolean {
  const root = state.meshRoot!
  const dx = target.x - root.position.x
  const dz = target.z - root.position.z
  const dist = Math.sqrt(dx * dx + dz * dz)
  if (dist < ARRIVE_THRESHOLD) return true

  const step = Math.min(dist, WALK_SPEED * speedMultiplier * dt)

  // 软分离力：积累来自附近 agent 的排斥力
  let sepX = 0,
    sepZ = 0
  ctx.agentAnimStates.forEach((other, otherIdx) => {
    if (otherIdx === state.agentIdx || !other.meshRoot) return
    const ox = root.position.x - other.meshRoot.position.x
    const oz = root.position.z - other.meshRoot.position.z
    const d2 = ox * ox + oz * oz
    if (d2 < AGENT_SEPARATION_RADIUS * AGENT_SEPARATION_RADIUS && d2 > 0.0001) {
      const d = Math.sqrt(d2)
      const force = (AGENT_SEPARATION_RADIUS - d) / AGENT_SEPARATION_RADIUS
      sepX += (ox / d) * force
      sepZ += (oz / d) * force
    }
  })
  const sepLen = Math.sqrt(sepX * sepX + sepZ * sepZ)
  if (sepLen > 1) {
    sepX /= sepLen
    sepZ /= sepLen
  }

  // 限制分离力贡献不超过步长的45%，防止在窄通道中分离力压倒前进力导致绕圈
  const rawSepX = sepX * AGENT_SEPARATION_STRENGTH * dt
  const rawSepZ = sepZ * AGENT_SEPARATION_STRENGTH * dt
  const rawSepMag = Math.sqrt(rawSepX * rawSepX + rawSepZ * rawSepZ)
  const sepCapMag = step * 0.45
  const sepFactor =
    rawSepMag > sepCapMag && rawSepMag > 0 ? sepCapMag / rawSepMag : 1.0
  const moveX = (dx / dist) * step + rawSepX * sepFactor
  const moveZ = (dz / dist) * step + rawSepZ * sepFactor
  const nx = root.position.x + moveX
  const nz = root.position.z + moveZ

  let finalX = nx,
    finalZ = nz
  if (isInsideObstacle(ctx, nx, nz)) {
    const xOk = !isInsideObstacle(ctx, nx, root.position.z)
    const zOk = !isInsideObstacle(ctx, root.position.x, nz)
    if (xOk && zOk) {
      if (Math.abs(dx) >= Math.abs(dz)) {
        finalX = nx
        finalZ = root.position.z
      } else {
        finalX = root.position.x
        finalZ = nz
      }
    } else if (xOk) {
      finalX = nx
      finalZ = root.position.z
    } else if (zOk) {
      finalX = root.position.x
      finalZ = nz
    } else {
      // 两轴都被阻挡（斜角碰壁），尝试向垂直方向滑行脱出，选更靠近目标的侧向
      const ang = Math.atan2(dx, dz)
      let bestDist = Infinity
      for (const sign of [1, -1]) {
        const cx =
          root.position.x + Math.sin(ang + (sign * Math.PI) / 2) * step * 0.6
        const cz =
          root.position.z + Math.cos(ang + (sign * Math.PI) / 2) * step * 0.6
        if (!isInsideObstacle(ctx, cx, cz)) {
          const d = (target.x - cx) ** 2 + (target.z - cz) ** 2
          if (d < bestDist) {
            bestDist = d
            finalX = cx
            finalZ = cz
          }
        }
      }
    }
  }

  // 硬碰撞：防止 agent 互相穿透
  ctx.agentAnimStates.forEach((other, otherIdx) => {
    if (otherIdx === state.agentIdx || !other.meshRoot) return
    const ax = finalX - other.meshRoot.position.x
    const az = finalZ - other.meshRoot.position.z
    const ad = Math.sqrt(ax * ax + az * az)
    if (ad > 0 && ad < AGENT_HARD_MIN_DIST) {
      // 每帧硬推上限0.08单位，防止两agent极近时推力溢出导致绕圈
      const rawPushDist = AGENT_HARD_MIN_DIST - ad
      const clampedPushDist = Math.min(rawPushDist, 0.08)
      finalX += (ax / ad) * clampedPushDist
      finalZ += (az / ad) * clampedPushDist
    }
  })

  root.position.x = finalX
  root.position.z = finalZ
  if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
    root.rotation.y = Math.atan2(dx, dz)
  }
  return false
}

/** 查找距当前 agent 较近、可能造成正面阻挡的其他 agent index，若无则返回 null */
export function findBlockingAgent(
  ctx: OfficeContext,
  state: AgentAnimState
): number | null {
  if (!state.meshRoot) return null
  let blockerIdx: number | null = null
  ctx.agentAnimStates.forEach((other, otherIdx) => {
    if (blockerIdx !== null || otherIdx === state.agentIdx || !other.meshRoot)
      return
    const dx = other.meshRoot.position.x - state.meshRoot!.position.x
    const dz = other.meshRoot.position.z - state.meshRoot!.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < AGENT_HARD_MIN_DIST * 2.5) blockerIdx = otherIdx
  })
  return blockerIdx
}
