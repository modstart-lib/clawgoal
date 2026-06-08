import { Vector3 } from '@babylonjs/core'
import type { AgentAnimState, OfficeContext } from '../office'
import { OFFICE_CONFIG } from '../config'
import { loadDesk } from './decoration'
import { playAnimState, scheduleRoam, orbBaseColor } from '../manager/state'

/**
 * 并发加载所有 agent 的桌子 + cube character，将结果写入 ctx.agentAnimStates。
 * onProgress(loaded) 每个 agent 完成后回调一次（loaded 从 1 开始）。
 */
export async function loadAgents(
  ctx: OfficeContext,
  deskLayout: Array<{ cx: number; cz: number }>,
  onProgress: (loaded: number) => void
): Promise<void> {
  const activeSlots = Math.min(ctx.agents.length, deskLayout.length)

  async function loadSlot(i: number): Promise<void> {
    if (ctx.disposed) return
    const { cx, cz } = deskLayout[i]
    const title = ctx.agents[i].name
    const isBusy = ctx.agents[i]?.busy ?? false
    const deskPos = new Vector3(cx, 0, cz)

    // 并行加载：桌子 + cube character
    const tasks: Promise<any>[] = []

    if (OFFICE_CONFIG.desktop) {
      tasks.push(loadDesk(ctx, cx, cz))
    } else {
      tasks.push(Promise.resolve())
    }

    let botTaskIdx = -1
    if (ctx.cubeEngine) {
      botTaskIdx = tasks.length
      tasks.push(
        ctx.cubeEngine
          .generate(ctx.agents[i]?.avatarConfig ?? null, {
            headTitle: title,
            headBallEnable: true,
            headBallColor: orbBaseColor(isBusy, true).toHexString(),
            position: [cx + 1.0, 0, cz - 0.5],
            rotationY: Math.PI / 2,
          })
          .catch((err) => {
            console.warn(
              `Failed to load character bot for agent ${title}:`,
              err
            )
            return null
          })
      )
    }

    const results = await Promise.all(tasks)
    if (ctx.disposed) return

    const bot = botTaskIdx >= 0 ? results[botTaskIdx] : null

    if (bot?.meshRoot) {
      bot.meshRoot.getChildMeshes(false).forEach((m: any) => {
        m._agentIdx = i
      })
    }

    if (!bot) {
      onProgress(i + 1)
      return
    }

    const initialState: 'idle' | 'working' = isBusy ? 'working' : 'idle'
    const animState: AgentAnimState = {
      bot,
      animateState: initialState,
      workStatus: isBusy ? 'working' : 'idle',
      prevState: initialState,
      startFrameOffset: Math.random(),
      meshRoot: bot.meshRoot,
      agentName: title,
      lastKnownBusy: isBusy,
      lastKnownAtDesk: true,
      deskPosition: deskPos,
      deskAngle: Math.PI / 2,
      roamTarget: null,
      roamPath: [],
      isHovered: false,
      agentIdx: i,
      urgentReturn: false,
      stuckTimer: 0,
      stuckCheckPos: deskPos.clone(),
      movementBlockedUntil: 0,
    }
    ctx.agentAnimStates.set(i, animState)
    playAnimState(animState, initialState)
    if (initialState === 'idle') scheduleRoam(ctx, animState, i)
    onProgress(i + 1)
  }

  await runWithConcurrency(activeSlots, 2, loadSlot)
}

function runWithConcurrency(
  count: number,
  limit: number,
  task: (i: number) => Promise<void>
): Promise<void> {
  return new Promise<void>((resolve) => {
    let next = 0,
      active = 0,
      done = 0
    if (count === 0) {
      resolve()
      return
    }
    function pick() {
      while (active < limit && next < count) {
        active++
        const i = next++
        task(i)
          .catch((err) => console.warn('loadAgent error', i, err))
          .finally(() => {
            active--
            done++
            if (done === count) resolve()
            else pick()
          })
      }
    }
    pick()
  })
}
