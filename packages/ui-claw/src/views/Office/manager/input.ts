import { Matrix, PointerEventTypes } from '@babylonjs/core'
import type { OfficeContext } from '../office'
import { isInsideObstacle } from './path'

// 鼠标离开行走中的 agent 后，恢复行走的延迟时间（ms）
const HOVER_RESUME_DELAY = 5000

export class InputManager {
  private ctx: OfficeContext
  private canvasEl: HTMLCanvasElement

  // 当前 hover 住的行走 agent 索引
  private hoveredWalkingIdx: number | null = null
  // 每个 agent 的恢复定时器（鼠标离开后 5s 恢复）
  private hoverResumeTimers = new Map<number, ReturnType<typeof setTimeout>>()

  // 拖拽状态
  private dragIdx: number | null = null
  private isDragging = false

  constructor(ctx: OfficeContext, canvasEl: HTMLCanvasElement) {
    this.ctx = ctx
    this.canvasEl = canvasEl
    this.setup()
  }

  private setup() {
    const { scene } = this.ctx
    if (!scene) return

    scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERMOVE) {
        this.onMove()
      } else if (info.type === PointerEventTypes.POINTERDOWN) {
        if ((info.event as MouseEvent).button === 0) this.onDown()
      } else if (info.type === PointerEventTypes.POINTERUP) {
        this.onUp()
      }
    })
  }

  private getPickedAgentIdx(): number | undefined {
    const { scene } = this.ctx
    if (!scene) return undefined
    const pick = scene.pick(scene.pointerX, scene.pointerY)
    const mesh = pick?.pickedMesh
    return mesh ? (mesh as any)._agentIdx : undefined
  }

  // ── 鼠标移动 ────────────────────────────────────────────────────────────────

  private onMove() {
    // 拖拽中：将 agent 移动到鼠标投影到 Y=0 平面的位置
    if (this.isDragging && this.dragIdx !== null) {
      this.updateDragPosition()
      return
    }

    const pickedIdx = this.getPickedAgentIdx()

    // 判断是否是行走中的 agent
    const isWalking = (i: number) => {
      const s = this.ctx.agentAnimStates.get(i)
      return (
        s && (s.animateState === 'roaming' || s.animateState === 'returning')
      )
    }
    // 判断是否是空闲（可拖拽）的 agent
    const isIdleFree = (i: number) => {
      const s = this.ctx.agentAnimStates.get(i)
      const agent = this.ctx.agents[i]
      return s && s.animateState === 'idle' && !agent?.busy
    }

    // 处理行走 agent 的 hover 变化
    const newWalkHovered =
      pickedIdx !== undefined && isWalking(pickedIdx) ? pickedIdx : null
    if (newWalkHovered !== this.hoveredWalkingIdx) {
      if (this.hoveredWalkingIdx !== null)
        this.leaveWalkingHover(this.hoveredWalkingIdx)
      this.hoveredWalkingIdx = newWalkHovered
      if (newWalkHovered !== null) this.enterWalkingHover(newWalkHovered)
    }

    // 光标反馈
    if (pickedIdx !== undefined && isIdleFree(pickedIdx)) {
      this.canvasEl.style.cursor = 'grab'
    } else if (newWalkHovered !== null) {
      this.canvasEl.style.cursor = 'pointer'
    } else {
      this.canvasEl.style.cursor = 'default'
    }
  }

  // ── 行走 agent Hover 逻辑 ───────────────────────────────────────────────────

  private enterWalkingHover(idx: number) {
    // 如有待恢复的定时器则取消（鼠标重新进入）
    if (this.hoverResumeTimers.has(idx)) {
      clearTimeout(this.hoverResumeTimers.get(idx))
      this.hoverResumeTimers.delete(idx)
    }
    const state = this.ctx.agentAnimStates.get(idx)
    if (!state) return
    state.isHovered = true
    state.bot?.animateSerial('idle')
  }

  private leaveWalkingHover(idx: number) {
    // 5s 后恢复
    const timer = setTimeout(() => {
      this.hoverResumeTimers.delete(idx)
      const state = this.ctx.agentAnimStates.get(idx)
      if (!state) return
      state.isHovered = false
      if (
        state.animateState === 'roaming' ||
        state.animateState === 'returning'
      ) {
        state.bot?.animateSerial('walk')
      }
    }, HOVER_RESUME_DELAY)
    this.hoverResumeTimers.set(idx, timer)
  }

  // ── 拖拽逻辑 ────────────────────────────────────────────────────────────────

  private onDown() {
    const pickedIdx = this.getPickedAgentIdx()
    if (pickedIdx === undefined) return

    const state = this.ctx.agentAnimStates.get(pickedIdx)
    const agent = this.ctx.agents[pickedIdx]
    if (!state || !agent) return
    if (state.animateState !== 'idle' || agent.busy) return

    this.dragIdx = pickedIdx
    this.isDragging = true
    this.canvasEl.style.cursor = 'grabbing'
    // 拖拽期间禁用相机旋转
    this.ctx.camera?.detachControl()
  }

  private onUp() {
    if (!this.isDragging) return
    this.isDragging = false
    this.dragIdx = null
    // 恢复相机控制
    if (this.ctx.canvasEl)
      this.ctx.camera?.attachControl(this.ctx.canvasEl, true)
    this.canvasEl.style.cursor = 'default'
  }

  private updateDragPosition() {
    const { scene, camera } = this.ctx
    if (!scene || !camera || this.dragIdx === null) return
    const state = this.ctx.agentAnimStates.get(this.dragIdx)
    if (!state?.meshRoot) return

    // 从鼠标位置发射射线，与 Y=0 地面平面求交
    const ray = scene.createPickingRay(
      scene.pointerX,
      scene.pointerY,
      Matrix.Identity(),
      camera
    )
    if (ray.direction.y >= -0.001) return // 视线平行或向上，忽略
    const t = -ray.origin.y / ray.direction.y
    const groundX = ray.origin.x + ray.direction.x * t
    const groundZ = ray.origin.z + ray.direction.z * t

    // 限制在房间范围内
    const margin = 2
    const clampedX = Math.max(
      margin,
      Math.min(this.ctx.floorWidth - margin, groundX)
    )
    const clampedZ = Math.max(
      margin,
      Math.min(this.ctx.floorDepth - margin, groundZ)
    )
    // 落点在障碍物内时不移动，避免 agent 卡入家具
    if (isInsideObstacle(this.ctx, clampedX, clampedZ)) return
    state.meshRoot.position.x = clampedX
    state.meshRoot.position.z = clampedZ
  }

  // ── 清理 ────────────────────────────────────────────────────────────────────

  dispose() {
    this.hoverResumeTimers.forEach((t) => clearTimeout(t))
    this.hoverResumeTimers.clear()
    if (this.isDragging && this.ctx.canvasEl) {
      this.ctx.camera?.attachControl(this.ctx.canvasEl, true)
    }
  }
}
