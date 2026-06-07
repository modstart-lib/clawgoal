import { Color3, Vector3 } from '@babylonjs/core'
import type { AgentAnimState, AgentState, OfficeContext } from '../office'
import { OFFICE_CONFIG } from '../config'
import {
  findBlockingAgent,
  findPath,
  isNearAnotherAgent,
  isNearDesk,
  moveToward,
  pickRoamTarget,
  STUCK_MIN_PROGRESS,
  STUCK_TIMEOUT,
  URGENT_RETURN_SPEED,
} from './path'

// ─── 漫游配置常量 ─────────────────────────────────────────────────────────────
/** 非忙碌 agent 同时闲逛的最大占比（30%） */
const ROAM_IDLE_FRACTION = 0.3
/** 所有 agent 同时闲逛的上限占比（30%），确保至少 70% 的人在工位上 */
const ROAM_TOTAL_FRACTION = 0.3
/** agent 漫游的最长时长（30s），超时自动返回桌子 */
const ROAM_MAX_DURATION = 30_000
/** 途经路点时触发随机停顿的概率 */
const ROAM_MID_STOP_CHANCE = 0.12
/** 附近有 agent 时最长停顿时长（5s） */
const ROAM_MAX_STOP_NEAR_AGENT = 5_000
/** 空闲后开始漫游的随机延迟区间 */
const ROAM_DELAY_MIN = 4_000
const ROAM_DELAY_MAX = 10_000

// ─── 状态球颜色 ───────────────────────────────────────────────────────────────

/** 根据 busy/atDesk 状态返回状态球颜色：绿(空闲) / 红(工作) / 橙(外出) */
export function orbBaseColor(busy: boolean, atDesk: boolean): Color3 {
  if (!busy) return new Color3(0.02, 0.32, 0.08) // 绿：空闲
  return atDesk ? new Color3(0.5, 0.04, 0.04) : new Color3(0.58, 0.4, 0.02) // 红：工作 / 橙：外出忙
}

// ─── 动画播放 ─────────────────────────────────────────────────────────────────

/** 切换 agent 动画并同步 animateState；若有站起过渡则填写 movementBlockedUntil */
export function playAnimState(
  state: AgentAnimState,
  newState: AgentState
): void {
  const ALIAS = {
    idle: 'idle',
    working: 'work',
    handup: 'handup',
    roaming: 'walk',
    returning: 'walk',
    playing: 'play',
  } as const satisfies Record<
    AgentState,
    'idle' | 'walk' | 'handup' | 'play' | 'work'
  >
  const alias = ALIAS[newState] ?? 'idle'
  const preDelay = state.bot?.animateAlias(alias) ?? 0
  state.animateState = newState
  if (preDelay > 0) {
    state.movementBlockedUntil = Date.now() + preDelay
  }
}

// ─── 漫游配额统计 ─────────────────────────────────────────────────────────────

function countRoamingAgents(ctx: OfficeContext): number {
  let n = 0
  ctx.agentAnimStates.forEach((s) => {
    if (
      s.animateState === 'roaming' ||
      s.animateState === 'returning' ||
      s.animateState === 'playing'
    )
      n++
  })
  return n
}

// ─── 状态切换：调度漫游 ───────────────────────────────────────────────────────

/** 在随机延迟后让 agent 开始漫游（若配额已满则重新调度） */
export function scheduleRoam(
  ctx: OfficeContext,
  state: AgentAnimState,
  idx: number
): void {
  if (!OFFICE_CONFIG.roamEnable) return
  if (state.roamStopTimer) clearTimeout(state.roamStopTimer)
  const delay =
    ROAM_DELAY_MIN + Math.random() * (ROAM_DELAY_MAX - ROAM_DELAY_MIN)
  state.roamStopTimer = setTimeout(() => {
    if (state.animateState !== 'idle') return
    if (ctx.agents[idx]?.busy) return
    const totalAgents = ctx.agentAnimStates.size
    const roaming = countRoamingAgents(ctx)
    const nonBusyCount = ctx.agents.filter((a) => !a.busy).length
    const maxByIdle = Math.max(1, Math.floor(nonBusyCount * ROAM_IDLE_FRACTION))
    const maxByTotal = Math.max(
      1,
      Math.floor(totalAgents * ROAM_TOTAL_FRACTION)
    )
    if (roaming >= Math.min(maxByIdle, maxByTotal)) {
      scheduleRoam(ctx, state, idx)
      return
    }
    startRoaming(ctx, state)
  }, delay)
}

/** 立即开始漫游，选取随机目标并规划路径；30s 后自动触发返回 */
export function startRoaming(ctx: OfficeContext, state: AgentAnimState): void {
  const target = pickRoamTarget(ctx)
  if (!target || !state.meshRoot) return
  state.roamTarget = target
  state.roamPath = findPath(ctx, state.meshRoot.position, target)
  playAnimState(state, 'roaming')
  if (state.roamStopTimer) clearTimeout(state.roamStopTimer)
  state.roamStopTimer = setTimeout(() => {
    if (state.animateState === 'roaming' || state.animateState === 'playing')
      startReturning(ctx, state)
  }, ROAM_MAX_DURATION)
}

/** 让 agent 开始返回自己的桌子 */
export function startReturning(
  ctx: OfficeContext,
  state: AgentAnimState
): void {
  if (state.roamStopTimer) clearTimeout(state.roamStopTimer)
  if (state.playTimer) {
    clearTimeout(state.playTimer)
    state.playTimer = undefined
  }
  state.roamTarget = null
  state.roamPath = state.meshRoot
    ? findPath(ctx, state.meshRoot.position, state.deskPosition)
    : []
  playAnimState(state, 'returning')
}

// ─── 到达目标后的播放动画 ─────────────────────────────────────────────────────

function schedulePlayAnim(
  ctx: OfficeContext,
  state: AgentAnimState,
  idx: number
): void {
  if (isNearDesk(state)) {
    playAnimState(state, 'idle')
    scheduleRoam(ctx, state, idx)
    return
  }
  // 到达目标后播放随机闲置动作
  state.bot?.animateAlias('play')
  state.animateState = 'playing'
  // 给坐下过渡+动画留足够时间再判断持续时长
  let duration = 3000 + Math.random() * 4000
  if (isNearAnotherAgent(ctx, state))
    duration = Math.min(duration, ROAM_MAX_STOP_NEAR_AGENT)
  state.playTimer = setTimeout(() => {
    if (state.animateState === 'playing') {
      playAnimState(state, 'idle')
      scheduleRoam(ctx, state, idx)
    }
  }, duration)
}

function schedulePlayAnimMidRoam(
  ctx: OfficeContext,
  state: AgentAnimState,
  idx: number
): void {
  const savedPath = [...state.roamPath]
  state.roamPath = []
  const resume = () => {
    if (state.animateState !== 'playing') return
    if (!ctx.agents[idx]?.busy && savedPath.length > 0 && !isNearDesk(state)) {
      state.roamPath = savedPath
      playAnimState(state, 'roaming')
    } else {
      playAnimState(state, 'idle')
      scheduleRoam(ctx, state, idx)
    }
  }
  if (Math.random() < 0.6) {
    // 途中停下来播放站立随机动作（不坐下，方便快速恢复）
    state.bot?.animateAlias('play')
    state.animateState = 'playing'
    let duration = 1500 + Math.random() * 2500
    if (isNearAnotherAgent(ctx, state))
      duration = Math.min(duration, ROAM_MAX_STOP_NEAR_AGENT)
    state.playTimer = setTimeout(() => {
      if (state.animateState === 'playing') resume()
    }, duration)
    return
  }
  playAnimState(state, 'idle')
  state.animateState = 'playing'
  let idleDuration = 800 + Math.random() * 1500
  if (isNearAnotherAgent(ctx, state))
    idleDuration = Math.min(idleDuration, ROAM_MAX_STOP_NEAR_AGENT)
  state.playTimer = setTimeout(() => {
    if (state.animateState === 'playing') resume()
  }, idleDuration)
}

// ─── 每帧更新：驱动状态机 ─────────────────────────────────────────────────────

/**
 * 每帧调用，根据 ctx.agents[idx].busy 状态驱动状态机切换和路径跟随。
 * 需在 scene.registerBeforeRender 中注册：`() => updateRoaming(ctx, engine.getDeltaTime()/1000)`
 */
export function updateRoaming(ctx: OfficeContext, dt: number): void {
  ctx.agentAnimStates.forEach((state, idx) => {
    if (!state.meshRoot) return
    const isBusy = ctx.agents[idx]?.busy ?? false

    // 同步 workStatus
    const newWorkStatus: 'working' | 'idle' = isBusy ? 'working' : 'idle'
    if (state.workStatus !== newWorkStatus) state.workStatus = newWorkStatus

    // 同步状态球颜色
    const atDesk = isNearDesk(state)
    if (isBusy !== state.lastKnownBusy || atDesk !== state.lastKnownAtDesk) {
      state.lastKnownBusy = isBusy
      state.lastKnownAtDesk = atDesk
      state.bot?.setBallColor(orbBaseColor(isBusy, atDesk).toHexString())
    }

    // ── playing 状态：只处理 busy 中断 ──
    if (state.animateState === 'playing') {
      if (isBusy) {
        if (state.playTimer) {
          clearTimeout(state.playTimer)
          state.playTimer = undefined
        }
        state.urgentReturn = true
        startReturning(ctx, state)
      }
      return
    }

    // ── idle <-> working 切换 ──
    if (state.animateState === 'idle' && isBusy) {
      if (state.roamStopTimer) clearTimeout(state.roamStopTimer)
      if (state.playTimer) {
        clearTimeout(state.playTimer)
        state.playTimer = undefined
      }
      if (!isNearDesk(state)) {
        state.urgentReturn = true
        startReturning(ctx, state)
      } else {
        playAnimState(state, 'working')
        state.prevState = 'working'
      }
      return
    }
    if (state.animateState === 'working' && !isBusy) {
      playAnimState(state, 'idle')
      state.prevState = 'idle'
      scheduleRoam(ctx, state, idx)
      return
    }

    // ── roaming：路径跟随 ──
    if (state.animateState === 'roaming') {
      if (isBusy) {
        state.urgentReturn = true
        startReturning(ctx, state)
        return
      }
      if (state.isHovered) return
      if (state.roamPath.length === 0 && !state.roamTarget) return
      if (state.roamPath.length === 0 && state.roamTarget) {
        state.roamPath = findPath(
          ctx,
          state.meshRoot.position,
          state.roamTarget
        )
      }
      if (state.roamPath.length === 0) return
      if (Date.now() < state.movementBlockedUntil) return

      const arrived = moveToward(ctx, state, state.roamPath[0], dt)
      if (arrived) {
        state.stuckTimer = 0
        state.stuckCheckPos.copyFrom(state.meshRoot.position)
        state.roamPath.shift()
        if (state.roamPath.length === 0) {
          state.roamTarget = null
          schedulePlayAnim(ctx, state, idx)
        } else if (!state.isHovered && Math.random() < ROAM_MID_STOP_CHANCE) {
          schedulePlayAnimMidRoam(ctx, state, idx)
        }
      } else {
        state.stuckTimer += dt
        if (state.stuckTimer >= STUCK_TIMEOUT) {
          if (
            Vector3.Distance(state.meshRoot.position, state.stuckCheckPos) <
            STUCK_MIN_PROGRESS
          ) {
            const blocker = findBlockingAgent(ctx, state)
            if (blocker !== null && blocker > idx) {
              // 对方 idx 更大，我先让路：暂停片刻等对方通过
              state.movementBlockedUntil =
                Date.now() + 1500 + Math.random() * 500
            } else {
              // 我 idx 更大或无阻挡者：放弃当前路径重新漫游
              state.roamPath = []
              state.roamTarget = null
              scheduleRoam(ctx, state, idx)
              playAnimState(state, 'idle')
            }
          }
          state.stuckTimer = 0
          state.stuckCheckPos.copyFrom(state.meshRoot.position)
        }
      }
      return
    }

    // ── returning：返回桌子（工作时快速返回，正面面对桌子） ──
    if (state.animateState === 'returning') {
      if (state.roamPath.length === 0) {
        state.roamPath = findPath(
          ctx,
          state.meshRoot.position,
          state.deskPosition
        )
      }
      if (state.roamPath.length === 0) {
        // 已在桌子旁，直接归位并正面朝向桌子
        state.urgentReturn = false
        state.meshRoot.position.x = state.deskPosition.x
        state.meshRoot.position.z = state.deskPosition.z
        state.meshRoot.rotation.y = state.deskAngle
        const nextState: 'idle' | 'working' = isBusy ? 'working' : 'idle'
        playAnimState(state, nextState)
        state.prevState = nextState
        if (!isBusy) scheduleRoam(ctx, state, idx)
        return
      }

      const retSpeed = state.urgentReturn ? URGENT_RETURN_SPEED : 1.0
      if (Date.now() < state.movementBlockedUntil) return
      const arrived = moveToward(ctx, state, state.roamPath[0], dt, retSpeed)
      if (arrived) {
        state.stuckTimer = 0
        state.stuckCheckPos.copyFrom(state.meshRoot.position)
        state.roamPath.shift()
        if (state.roamPath.length === 0) {
          state.urgentReturn = false
          state.meshRoot.position.x = state.deskPosition.x
          state.meshRoot.position.z = state.deskPosition.z
          state.meshRoot.rotation.y = state.deskAngle
          const nextState: 'idle' | 'working' = isBusy ? 'working' : 'idle'
          playAnimState(state, nextState)
          state.prevState = nextState
          if (!isBusy) scheduleRoam(ctx, state, idx)
        }
      } else {
        state.stuckTimer += dt
        if (state.stuckTimer >= STUCK_TIMEOUT) {
          if (
            Vector3.Distance(state.meshRoot.position, state.stuckCheckPos) <
            STUCK_MIN_PROGRESS
          ) {
            const blocker = findBlockingAgent(ctx, state)
            if (blocker !== null && blocker > idx) {
              // 对方 idx 更大，我先让路：暂停片刻等对方通过
              state.movementBlockedUntil =
                Date.now() + 1500 + Math.random() * 500
            } else {
              // 我 idx 更大或无阻挡者：重新规划返回路径
              state.roamPath = findPath(
                ctx,
                state.meshRoot.position,
                state.deskPosition
              )
            }
          }
          state.stuckTimer = 0
          state.stuckCheckPos.copyFrom(state.meshRoot.position)
        }
      }
    }
  })
}
