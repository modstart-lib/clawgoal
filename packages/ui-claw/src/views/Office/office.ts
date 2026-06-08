import {
  Animation,
  ArcRotateCamera,
  AxesViewer,
  Color3,
  DirectionalLight,
  EasingFunction,
  Engine,
  HemisphericLight,
  Matrix,
  PointerEventTypes,
  PointLight,
  QuadraticEase,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { reactive } from 'vue'
import { updateAgentBasic } from '@/claw/api/agent'
import { useAgentStore } from '@/claw/stores/agent'
import type { CharacterConfig, CubeCharacterBot } from 'cube-character'
import { buildRandomConfig, createCubeCharacterFactory } from 'cube-character'
import type { SceneMaterial } from './types'
import { MESHES_CONFIG, OFFICE_CONFIG, PALETTE } from './config'
import { buildStaticRoom, buildLowPolyEnvironment } from './mesh/room'
import {
  loadBoards,
  loadPrinter,
  loadBookshelf,
  loadFridge,
  loadSofa,
  loadHouseplants,
  loadBrandText,
} from './mesh/decoration'
import { loadAgents } from './mesh/agent'
import { buildWalkablePoints, findPath, pickRoamTarget } from './manager/path'
import { playAnimState, scheduleRoam, updateRoaming } from './manager/state'
import { InputManager } from './manager/input'

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export type AgentState =
  | 'idle'
  | 'working'
  | 'handup'
  | 'roaming'
  | 'returning'
  | 'playing'

export interface AgentView {
  id: string
  name: string
  roleName: string
  color: string
  busy: boolean
  avatar: string | null
  avatarConfig: CharacterConfig | null
}

export interface AgentAnimState {
  bot: CubeCharacterBot
  animateState: AgentState
  workStatus: 'working' | 'idle'
  prevState: 'idle' | 'working'
  handupTimer?: ReturnType<typeof setTimeout>
  startFrameOffset: number
  meshRoot: TransformNode | null
  agentName: string
  lastKnownBusy: boolean
  lastKnownAtDesk: boolean
  deskPosition: Vector3
  deskAngle: number
  roamTarget: Vector3 | null
  roamPath: Vector3[]
  roamStopTimer?: ReturnType<typeof setTimeout>
  playTimer?: ReturnType<typeof setTimeout>
  isHovered: boolean
  agentIdx: number
  stuckTimer: number
  stuckCheckPos: Vector3
  urgentReturn: boolean
  /** 站起过渡期间（floor_sit→walk）屏蔽物理移动，直到该时间戳之后才移动 */
  movementBlockedUntil: number
}

export interface HandupBubble {
  idx: number
  x: number
  y: number
  name: string
  text: string
}

// CubeCharacterFactory 实例的最小接口
export interface CubeEngineInstance {
  generate(
    avatarConfig: CharacterConfig | null,
    options: {
      headTitle: string
      headBallEnable: boolean
      headBallColor: string
      position: [number, number, number]
      rotationY: number
    }
  ): Promise<CubeCharacterBot | null>
  destroy(): void
}

// ─── 全局 OfficeContext ────────────────────────────────────────────────────────
// 作为唯一数据源，传递给所有子模块函数的默认参数对象
export interface OfficeContext {
  // BabylonJS 核心对象
  scene: Scene | null
  engine: Engine | null
  camera: ArcRotateCamera | null
  shadowGen: ShadowGenerator | null
  canvasEl: HTMLCanvasElement | null
  cubeEngine: CubeEngineInstance | null

  // Agent 数据
  agents: AgentView[]
  agentAnimStates: Map<number, AgentAnimState>

  // 障碍物注册表 & 可行走区域
  materials: SceneMaterial[]
  walkablePoints: Vector3[]
  walkableSet: Set<string>

  // 房间尺寸 & 相机默认值
  floorWidth: number
  floorDepth: number
  defaultRadius: number
  defaultTarget: Vector3

  disposed: boolean
}

export function createOfficeContext(): OfficeContext {
  return {
    scene: null,
    engine: null,
    camera: null,
    shadowGen: null,
    canvasEl: null,
    cubeEngine: null,
    agents: reactive([]) as AgentView[],
    agentAnimStates: new Map(),
    materials: [],
    walkablePoints: [],
    walkableSet: new Set(),
    floorWidth: 0,
    floorDepth: 0,
    defaultRadius: 1000,
    defaultTarget: new Vector3(0, 2, 0),
    disposed: false,
  }
}

// ─── 布局计算 ─────────────────────────────────────────────────────────────────

function calcLayout(agentCount: number) {
  const colsCount = Math.max(1, Math.ceil(Math.sqrt(agentCount)))
  const rowsCount = Math.max(1, Math.ceil(agentCount / colsCount))
  const spacingX = 7.2
  const spacingZ = 7.2
  const paddingX = 15
  const paddingZ = 15
  const desksWidth = Math.max(0, colsCount - 1) * spacingX
  const desksDepth = Math.max(0, rowsCount - 1) * spacingZ
  const floorWidth = desksWidth + paddingX * 2
  const floorDepth = desksDepth + paddingZ * 2
  const agentHalfSpan = Math.max(desksWidth / 2 + 7, desksDepth / 2 + 7)
  const defaultRadius = Math.max(18, agentHalfSpan * 2.1)

  const deskLayout: Array<{ cx: number; cz: number }> = []
  for (let r = 0; r < rowsCount; r++) {
    for (let c = 0; c < colsCount; c++) {
      deskLayout.push({
        cx: paddingX + c * spacingX,
        cz: paddingZ + r * spacingZ,
      })
    }
  }
  // 有空位时，把最靠近默认相机角（cx+cz 最大）的桌子放前面，空位沉底
  if (agentCount < colsCount * rowsCount) {
    deskLayout.sort((a, b) => b.cx + b.cz - (a.cx + a.cz))
  }

  return {
    colsCount,
    rowsCount,
    floorWidth,
    floorDepth,
    defaultRadius,
    deskLayout,
  }
}

// ─── 障碍物注册表构建 ─────────────────────────────────────────────────────────

function buildMaterials(
  ctx: OfficeContext,
  deskLayout: Array<{ cx: number; cz: number }>
) {
  const cfg = MESHES_CONFIG
  ctx.materials = []

  // 桌子中心 (cx+2.5, cz)
  for (const { cx, cz } of deskLayout) {
    ctx.materials.push({
      id: `desk_${cx}_${cz}`,
      type: 'desk',
      x: cx + 2.5,
      z: cz,
      width: cfg.desktop.width,
      depth: cfg.desktop.depth,
      boxScale: cfg.desktop.boxScale,
    })
  }

  ctx.materials.push({
    id: 'printer',
    type: 'printer',
    x: 2,
    z: 35,
    width: cfg.printer.width,
    depth: cfg.printer.depth,
    boxScale: cfg.printer.boxScale,
  })
  ctx.materials.push({
    id: 'sofa',
    type: 'sofa',
    x: 2,
    z: 15,
    width: cfg.sofa.width,
    depth: cfg.sofa.depth,
    boxScale: cfg.sofa.boxScale,
  })

  if (OFFICE_CONFIG.bookshelf && cfg.bookshelf) {
    ctx.materials.push({
      id: 'bookshelf',
      type: 'bookshelf',
      x: 1,
      z: 2,
      width: cfg.bookshelf.width,
      depth: cfg.bookshelf.depth,
      boxScale: cfg.bookshelf.boxScale,
    })
  }
  if (OFFICE_CONFIG.fridge && cfg.fridge) {
    ctx.materials.push({
      id: 'fridge',
      type: 'fridge',
      x: 28,
      z: 1,
      width: cfg.fridge.width,
      depth: cfg.fridge.depth,
      boxScale: cfg.fridge.boxScale,
    })
  }

  // 植物
  if (OFFICE_CONFIG.plants && cfg.plant) {
    const hpCfg = cfg.plant
    const plantSpacing = 16
    const wallCornerPadding = 8
    let plantIdx = 0
    for (
      let x = wallCornerPadding;
      x <= ctx.floorWidth - wallCornerPadding;
      x += plantSpacing
    ) {
      const s = 1.5 + Math.random() * 0.5
      const a = ((Math.random() - 0.5) * Math.PI) / 4
      ctx.materials.push({
        id: `plant_${plantIdx++}`,
        type: 'plant',
        x,
        z: 2,
        width: hpCfg.width * s,
        depth: hpCfg.depth * s,
        boxScale: hpCfg.boxScale,
        scaleMultiplier: s,
        angle: a,
      })
    }
    for (
      let z = wallCornerPadding;
      z <= ctx.floorDepth - wallCornerPadding;
      z += plantSpacing
    ) {
      if (Math.abs(z - 2) < plantSpacing / 2) continue
      const s = 1.5 + Math.random() * 0.5
      const a = ((Math.random() - 0.5) * Math.PI) / 4
      ctx.materials.push({
        id: `plant_${plantIdx++}`,
        type: 'plant',
        x: 2,
        z,
        width: hpCfg.width * s,
        depth: hpCfg.depth * s,
        boxScale: hpCfg.boxScale,
        scaleMultiplier: s,
        angle: a,
      })
    }
  }

  // 告示板
  if (OFFICE_CONFIG.boards && cfg.boards.length > 0) {
    const boardSpacing = 20
    let bottomBoardIdx = 0
    for (let x = 12; x <= ctx.floorWidth - 12; x += boardSpacing) {
      const bCfg = cfg.boards[bottomBoardIdx % cfg.boards.length]
      ctx.materials.push({
        id: `board_bottom_${x}`,
        type: 'board',
        x,
        z: 0.35,
        width: bCfg.depth,
        depth: bCfg.width,
        boxScale: bCfg.boxScale,
      })
      bottomBoardIdx++
    }
    const leftZPositions: number[] = []
    for (let z = 12; z <= ctx.floorDepth - 12; z += boardSpacing)
      leftZPositions.push(z)
    const leftLen = leftZPositions.length
    for (let j = 0; j < leftLen; j++) {
      const cfgIdx = leftLen - 1 - j
      const bCfg = cfg.boards[cfgIdx % cfg.boards.length]
      ctx.materials.push({
        id: `board_left_${leftZPositions[j]}`,
        type: 'board',
        x: 0.35,
        z: leftZPositions[j],
        width: bCfg.width,
        depth: bCfg.depth,
        boxScale: bCfg.boxScale,
      })
    }
  }
}

// ─── 主入口：构建整个 Office 场景 ─────────────────────────────────────────────

export async function buildOffice(
  ctx: OfficeContext,
  canvasEl: HTMLCanvasElement,
  callbacks: {
    onLoadProgress: (loaded: number, total: number) => void
    onBubbleUpdate: (bubbles: HandupBubble[]) => void
    getHandupText: (busy: boolean) => string
    onAgentBodyClick: (idx: number) => void
  }
): Promise<void> {
  ctx.canvasEl = canvasEl

  // 1. 拉取 agent 信息
  try {
    const { agents, load } = useAgentStore()
    await load()
    const rawAgents = agents.value
    const mappedAgents = rawAgents.map((a: any, i: number) => ({
      id: a.id,
      name: a.title,
      roleName: a.roleName,
      color: PALETTE[i % PALETTE.length],
      busy: a.workStatus === 'working',
      avatar: a.avatar ?? null,
      avatarConfig: (a.avatarConfig as CharacterConfig | null) ?? null,
    }))
    ctx.agents.splice(0, ctx.agents.length, ...mappedAgents)
  } catch (err) {
    console.warn('Failed to load agents, using empty list', err)
  }

  // 1.5 为没有 avatarConfig 的 agent 生成随机配置并保存，确保构建场景时形象一致
  {
    const patchPromises = ctx.agents
      .filter((agent) => !agent.avatarConfig)
      .map(async (agent) => {
        const config = buildRandomConfig()
        try {
          await updateAgentBasic(agent.id, {
            avatarConfig: config as unknown as Record<string, unknown>,
          })
          agent.avatarConfig = config
        } catch (err) {
          console.warn(`Failed to save avatarConfig for agent ${agent.id}`, err)
        }
      })
    await Promise.all(patchPromises)
  }

  // 2. 计算布局参数
  const agentCount = ctx.agents.length
  const { floorWidth, floorDepth, defaultRadius, deskLayout } =
    calcLayout(agentCount)
  ctx.floorWidth = floorWidth
  ctx.floorDepth = floorDepth
  ctx.defaultRadius = defaultRadius
  ctx.defaultTarget = new Vector3(floorWidth / 2, 2, floorDepth / 2)

  // 3. 初始化 BabylonJS Engine & Scene
  ctx.engine = new Engine(canvasEl, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    adaptToDeviceRatio: true,
  })
  ctx.scene = new Scene(ctx.engine)
  ctx.scene.autoClear = true
  ctx.scene.ambientColor = new Color3(0.4, 0.4, 0.45)

  // 4. 相机
  ctx.camera = new ArcRotateCamera(
    'cam',
    Math.PI / 4,
    Math.PI / 3.2,
    defaultRadius,
    ctx.defaultTarget.clone(),
    ctx.scene
  )
  ctx.camera.attachControl(canvasEl, true)
  ctx.camera.inputs.removeByType('ArcRotateCameraMouseWheelInput')
  ctx.camera.lowerRadiusLimit = 8
  ctx.camera.upperRadiusLimit = 300
  ctx.camera.upperBetaLimit = Math.PI / 2.2

  if (OFFICE_CONFIG.debug) new AxesViewer(ctx.scene, 20)

  // 5. 灯光
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), ctx.scene)
  hemi.intensity = 0.8
  hemi.diffuse = new Color3(1, 0.98, 0.95)
  hemi.groundColor = new Color3(0.3, 0.3, 0.35)

  const dirLight = new DirectionalLight(
    'dir',
    new Vector3(-0.6, -0.65, 0.5),
    ctx.scene
  )
  dirLight.intensity = 0.8
  dirLight.diffuse = new Color3(1.0, 0.98, 0.95)
  dirLight.position = new Vector3(35 + floorWidth / 2, 40, -35 + floorDepth / 2)

  const fillLight = new DirectionalLight(
    'fill',
    new Vector3(1, -1.0, 0.5),
    ctx.scene
  )
  fillLight.intensity = 0.5
  fillLight.diffuse = new Color3(0.9, 0.92, 1.0)

  const frontLight = new DirectionalLight(
    'front',
    new Vector3(0, -1, 1),
    ctx.scene
  )
  frontLight.intensity = 0.4
  frontLight.diffuse = new Color3(1.0, 0.97, 0.93)

  const cornerLight = new DirectionalLight(
    'corner',
    new Vector3(0.7, -0.4, -0.7),
    ctx.scene
  )
  cornerLight.intensity = 0.4
  cornerLight.diffuse = new Color3(0.95, 0.93, 0.88)

  const lightCountX = Math.max(2, Math.ceil(floorWidth / 20))
  const lightCountZ = Math.max(2, Math.ceil(floorDepth / 20))
  const lightStepX = floorWidth / lightCountX
  const lightStepZ = floorDepth / lightCountZ
  for (let ix = 0; ix < lightCountX; ix++) {
    for (let iz = 0; iz < lightCountZ; iz++) {
      const pl = new PointLight(
        `pl${ix}_${iz}`,
        new Vector3(
          lightStepX / 2 + ix * lightStepX,
          5,
          lightStepZ / 2 + iz * lightStepZ
        ),
        ctx.scene
      )
      const densityRatio = (lightCountX * lightCountZ) / 9
      pl.intensity = densityRatio > 1 ? 0.6 / Math.sqrt(densityRatio) : 0.6
      pl.diffuse = new Color3(1, 0.97, 0.88)
      pl.range = Math.max(35, Math.max(lightStepX, lightStepZ) * 1.5)
    }
  }

  ctx.shadowGen = new ShadowGenerator(2048, dirLight)
  ctx.shadowGen.useBlurExponentialShadowMap = true
  ctx.shadowGen.blurKernel = 32

  // 6. 构建房间（room.ts）
  buildStaticRoom(ctx.scene, floorWidth, floorDepth)
  buildLowPolyEnvironment(ctx.scene, floorWidth, floorDepth)

  // 7. 构建静态装饰物（decoration.ts）- fire-and-forget
  const cfg = MESHES_CONFIG
  if (OFFICE_CONFIG.printer) loadPrinter(ctx, 2, 35).catch(console.warn)
  if (OFFICE_CONFIG.brand) loadBrandText(ctx, 2, 35)
  if (OFFICE_CONFIG.bookshelf && cfg.bookshelf)
    loadBookshelf(ctx, 1, 2).catch(console.warn)
  if (OFFICE_CONFIG.fridge && cfg.fridge)
    loadFridge(ctx, 28, 1).catch(console.warn)
  if (OFFICE_CONFIG.sofa) loadSofa(ctx, 2, 15).catch(console.warn)
  if (OFFICE_CONFIG.boards)
    loadBoards(ctx, floorWidth, floorDepth).catch(console.warn)

  // 8. 构建障碍物注册表 & 可行走区域
  buildMaterials(ctx, deskLayout)
  buildWalkablePoints(ctx)

  // 植物在 materials 注册后加载
  if (OFFICE_CONFIG.plants && cfg.plant) {
    loadHouseplants(ctx).catch(console.warn)
  }

  // 9. 初始化 CubeCharacterFactory
  ctx.cubeEngine = createCubeCharacterFactory(ctx.scene, {
    scale: 3,
    debug: OFFICE_CONFIG.debug,
    // 生产打包后 import.meta.url 指向 /assets/chunk.js，会导致资产路径变成
    // /assets/assets/，此处在生产环境显式指定资产根路径以修复双重 assets 问题
    ...(import.meta.env.PROD ? { assetsBaseUrl: '/cube-character/' } : {}),
  }) as CubeEngineInstance

  // 10. 构建 agent（agent.ts）
  const activeSlots = Math.min(ctx.agents.length, deskLayout.length)
  callbacks.onLoadProgress(0, activeSlots)
  await loadAgents(ctx, deskLayout, (loaded) =>
    callbacks.onLoadProgress(loaded, activeSlots)
  )

  // 11. 启动渲染循环 & 每帧状态更新
  if (!ctx.engine) return
  ctx.engine.runRenderLoop(() => {
    if (ctx.disposed) return
    ctx.scene?.render()
  })
  ctx.scene.registerBeforeRender(() => {
    if (ctx.disposed || !ctx.engine) return
    const dt = ctx.engine.getDeltaTime() / 1000
    updateRoaming(ctx, dt)
  })

  // 12. 事件：鼠标点击
  const handupBubbles: HandupBubble[] = []

  ctx.scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERPICK) return
    const mesh = info.pickInfo?.pickedMesh
    if (!mesh) return
    const idx: number | undefined = (mesh as any)._agentIdx
    if (idx !== undefined) {
      triggerHandup(
        ctx,
        idx,
        handupBubbles,
        callbacks.getHandupText,
        callbacks.onBubbleUpdate
      )
      callbacks.onAgentBodyClick(idx)
    }
  })

  // 13. 鼠标交互：hover 停止行走 + 拖拽空闲 agent
  new InputManager(ctx, canvasEl)
}

// ─── triggerHandup：触发举手动画 + 气泡 ───────────────────────────────────────

export function triggerHandup(
  ctx: OfficeContext,
  idx: number,
  bubbles: HandupBubble[],
  getHandupText: (busy: boolean) => string,
  onBubbleUpdate: (bubbles: HandupBubble[]) => void
): void {
  const state = ctx.agentAnimStates.get(idx)
  if (!state || state.animateState === 'handup') return
  const prevFull = state.animateState
  if (prevFull === 'idle' || prevFull === 'working') state.prevState = prevFull
  if (state.handupTimer) clearTimeout(state.handupTimer)
  playAnimState(state, 'handup')

  // 投影到屏幕坐标显示气泡
  if (state.meshRoot && ctx.camera && ctx.scene && ctx.engine && ctx.canvasEl) {
    const headWorldPos = state.meshRoot.position.clone()
    headWorldPos.y += 4.6
    const vp = ctx.camera.viewport.toGlobal(
      ctx.engine.getRenderWidth(),
      ctx.engine.getRenderHeight()
    )
    const screenPos = Vector3.Project(
      headWorldPos,
      Matrix.Identity(),
      ctx.scene.getTransformMatrix(),
      vp
    )
    if (screenPos.z > 0 && screenPos.z < 1) {
      const scaleX = ctx.canvasEl.clientWidth / ctx.engine.getRenderWidth()
      const scaleY = ctx.canvasEl.clientHeight / ctx.engine.getRenderHeight()
      const filtered = bubbles.filter((b) => b.idx !== idx)
      filtered.push({
        idx,
        x: screenPos.x * scaleX,
        y: screenPos.y * scaleY,
        name: state.agentName,
        text: getHandupText(state.workStatus === 'working'),
      })
      bubbles.splice(0, bubbles.length, ...filtered)
      onBubbleUpdate([...bubbles])
    }
  }

  state.handupTimer = setTimeout(() => {
    const updated = bubbles.filter((b) => b.idx !== idx)
    bubbles.splice(0, bubbles.length, ...updated)
    onBubbleUpdate([...bubbles])
    if (!ctx.agentAnimStates.has(idx)) return
    if (prevFull === 'roaming') {
      const target = pickRoamTarget(ctx)
      if (target && state.meshRoot) {
        state.roamTarget = target
        state.roamPath = findPath(ctx, state.meshRoot.position, target)
        playAnimState(state, 'roaming')
      } else {
        playAnimState(state, 'idle')
        scheduleRoam(ctx, state, idx)
      }
    } else if (prevFull === 'returning') {
      playAnimState(state, 'returning')
    } else {
      playAnimState(state, state.prevState)
    }
  }, 3000)
}

// ─── 相机控制 ─────────────────────────────────────────────────────────────────

const ZOOM_STEP = 2

export function resetCamera(ctx: OfficeContext): void {
  if (!ctx.camera || !ctx.scene) return
  const fps = 60
  const totalFrames = 40
  const ease = new QuadraticEase()
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT)
  ctx.scene.stopAnimation(ctx.camera)
  Animation.CreateAndStartAnimation(
    'camReset_radius',
    ctx.camera,
    'radius',
    fps,
    totalFrames,
    ctx.camera.radius,
    ctx.defaultRadius,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
    ease
  )
  Animation.CreateAndStartAnimation(
    'camReset_alpha',
    ctx.camera,
    'alpha',
    fps,
    totalFrames,
    ctx.camera.alpha,
    Math.PI / 4,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
    ease
  )
  Animation.CreateAndStartAnimation(
    'camReset_beta',
    ctx.camera,
    'beta',
    fps,
    totalFrames,
    ctx.camera.beta,
    Math.PI / 3.2,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
    ease
  )
  Animation.CreateAndStartAnimation(
    'camReset_target',
    ctx.camera,
    'target',
    fps,
    totalFrames,
    ctx.camera.target.clone(),
    ctx.defaultTarget.clone(),
    Animation.ANIMATIONLOOPMODE_CONSTANT,
    ease
  )
}

export function zoomIn(ctx: OfficeContext): void {
  if (!ctx.camera) return
  ctx.camera.radius = Math.max(
    ctx.camera.lowerRadiusLimit ?? 8,
    ctx.camera.radius - ZOOM_STEP
  )
}

export function zoomOut(ctx: OfficeContext): void {
  if (!ctx.camera) return
  ctx.camera.radius = Math.min(
    ctx.camera.upperRadiusLimit ?? 100,
    ctx.camera.radius + ZOOM_STEP
  )
}

export function handleWheel(ctx: OfficeContext, e: WheelEvent): void {
  if (!e.ctrlKey) return
  e.preventDefault()
  e.stopPropagation()
  if (ctx.camera) {
    ctx.camera.radius = Math.max(
      ctx.camera.lowerRadiusLimit ?? 8,
      Math.min(
        ctx.camera.upperRadiusLimit ?? 100,
        ctx.camera.radius + e.deltaY * 0.08
      )
    )
  }
}

// ─── 随机测试：每 10s 随机切换 agent 忙碌状态 ────────────────────────────────

export function randomTest(ctx: OfficeContext): void {
  if (ctx.agents.length === 0) return
  const count = ctx.agents.length
  const busyCount = Math.min(4, count)
  const indices = Array.from({ length: count }, (_, i) => i).sort(
    () => Math.random() - 0.5
  )
  indices.forEach((idx, pos) => {
    const state = ctx.agentAnimStates.get(idx)
    if (state?.animateState === 'returning' && ctx.agents[idx].busy) return
    ctx.agents[idx].busy = pos < busyCount
  })
}

// ─── 销毁 Office 场景 ─────────────────────────────────────────────────────────

export function destroyOffice(ctx: OfficeContext): void {
  ctx.disposed = true
  ctx.agentAnimStates.forEach((state) => {
    if (state.handupTimer) clearTimeout(state.handupTimer)
    if (state.roamStopTimer) clearTimeout(state.roamStopTimer)
    if (state.playTimer) clearTimeout(state.playTimer)
  })
  ctx.agentAnimStates.clear()
  ctx.walkablePoints = []
  // Stop render loop before disposing scene/engine to prevent any in-flight renders
  if (ctx.engine) {
    try {
      ctx.engine.stopRenderLoop()
    } catch {
      /* ignore */
    }
  }
  if (ctx.cubeEngine) {
    ctx.cubeEngine.destroy()
    ctx.cubeEngine = null
  }
  if (ctx.scene) {
    try {
      ctx.scene.dispose()
    } catch {
      /* ignore */
    }
    ctx.scene = null
  }
  if (ctx.engine) {
    try {
      ctx.engine.dispose()
    } catch {
      /* ignore */
    }
    ctx.engine = null
  }
}
