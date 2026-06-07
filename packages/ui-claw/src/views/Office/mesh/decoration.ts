import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  SceneLoader,
  StandardMaterial,
  Tools,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import type { MeshEntity } from '../types'
import { MESHES_CONFIG, OFFICE_CONFIG } from '../config'
import { normalAngle, normalOffset, normalScale } from '../utils/util'
import type { OfficeContext } from '../office'

// ─── 修复 BabylonJS 内嵌 data URI 纹理路径拼接 bug ──────────────────────────
const _origPreprocessUrl = Tools.PreprocessUrl
Tools.PreprocessUrl = (url: string) => {
  const match = url.match(/(data:image\/[^;]+;base64,.*)/)
  return _origPreprocessUrl(match ? match[1] : url)
}

// ─── 模型文件 URL 解析（Vite eager import）─────────────────────────────────
const glbLoaders: Record<string, string> = {
  ...(import.meta.glob('./../model/*.glb', {
    query: '?url',
    import: 'default',
    eager: true,
  }) as Record<string, string>),
}

function resolveModelUrl(file: string): string {
  const entry = Object.entries(glbLoaders).find(([k]) => k.endsWith(`/${file}`))
  if (!entry) throw new Error(`Model not found: ${file}`)
  return entry[1]
}

// ─── 碰撞盒附加（内部工具）──────────────────────────────────────────────────
function attachHitbox(
  ctx: OfficeContext,
  worldX: number,
  worldZ: number,
  cfg: MeshEntity,
  instanceScale = 1.0,
  debugColor: Color3 = new Color3(0, 1, 0.2),
  centerY?: number,
  swapWidthDepth?: boolean
): Mesh {
  const sc = ctx.scene!
  const bsx = (cfg.boxScale?.[0] ?? 1) * instanceScale
  const bsy = (cfg.boxScale?.[1] ?? 1) * instanceScale
  const bsz = (cfg.boxScale?.[2] ?? 1) * instanceScale
  let w = cfg.width * bsx
  const h = cfg.height * bsy
  let d = cfg.depth * bsz
  if (swapWidthDepth) {
    ;[w, d] = [d, w]
  }
  const id = `hitbox_${cfg.name}_${worldX.toFixed(1)}_${worldZ.toFixed(1)}_${Date.now()}_${Math.random().toFixed(4)}`
  const box = MeshBuilder.CreateBox(id, { width: w, height: h, depth: d }, sc)
  box.position = new Vector3(worldX, centerY ?? h / 2, worldZ)
  box.isPickable = false
  if (OFFICE_CONFIG.debug) {
    const mat = new StandardMaterial(`${id}_mat`, sc)
    mat.wireframe = true
    mat.emissiveColor = debugColor
    mat.disableLighting = true
    box.material = mat
  } else {
    box.isVisible = false
  }
  return box
}

// ─── 桌子 ────────────────────────────────────────────────────────────────────

export async function loadDesk(
  ctx: OfficeContext,
  cx: number,
  cz: number
): Promise<void> {
  if (ctx.disposed || !ctx.scene || !ctx.shadowGen) return
  const deskCfg = MESHES_CONFIG.desktop
  try {
    const url = resolveModelUrl(deskCfg.file)
    if (ctx.disposed) return
    const result = await SceneLoader.ImportMeshAsync('', '', url, ctx.scene)
    if (ctx.disposed) return
    const meshes = result.meshes as Mesh[]
    const root = meshes[0]
    root.position = new Vector3(
      ...normalOffset(cx + 2.5, deskCfg.groundOffset ?? 0, cz, deskCfg.offset)
    )
    root.rotationQuaternion = null
    root.rotation.y = normalAngle(0, deskCfg.angle)
    const s = normalScale(1, deskCfg.scale)
    root.scaling = new Vector3(s, s, s)
    meshes.forEach((m) => {
      if (m.name.startsWith('Chair')) {
        m.isVisible = false
        return
      }
      m.receiveShadows = true
      ctx.shadowGen!.addShadowCaster(m)
    })
    attachHitbox(ctx, cx + 2.5, cz, deskCfg, 1, new Color3(1, 0.9, 0))
  } catch (err) {
    if (!ctx.disposed) console.warn('Failed to load desk:', err)
  }
}

// ─── 告示板 ──────────────────────────────────────────────────────────────────

export async function loadBoards(
  ctx: OfficeContext,
  floorWidth: number,
  floorDepth: number
): Promise<void> {
  if (ctx.disposed || !ctx.scene || !ctx.shadowGen) return
  const boardCfgs = MESHES_CONFIG.boards
  const boardSpacing = 20
  const bottomWallPositions: Array<{
    position: [number, number, number]
    angle: number
  }> = []
  for (let x = 12; x <= floorWidth - 12; x += boardSpacing) {
    bottomWallPositions.push({ position: [x, 4.2, 0.35], angle: -Math.PI / 2 })
  }
  const leftWallPositions: Array<{
    position: [number, number, number]
    angle: number
  }> = []
  for (let z = 12; z <= floorDepth - 12; z += boardSpacing) {
    leftWallPositions.push({ position: [0.35, 4.2, z], angle: 0 })
  }

  const containers = await Promise.all(
    boardCfgs.map(async (cfg) => {
      try {
        return await SceneLoader.LoadAssetContainerAsync(
          resolveModelUrl(cfg.file),
          '',
          ctx.scene!
        )
      } catch (err) {
        console.warn('Failed to load board:', err)
        return null
      }
    })
  )
  let boardSeq = 0

  async function placeBoard(
    p: { position: [number, number, number]; angle: number },
    cfgIdx: number
  ) {
    const boardCfg = boardCfgs[cfgIdx % boardCfgs.length]
    const container = containers[cfgIdx % containers.length]
    if (!container || ctx.disposed) return
    const seq = boardSeq++
    const inst = container.instantiateModelsToScene((n) => `board_${seq}_${n}`)
    const root = inst.rootNodes[0] as TransformNode
    if (!root) return
    root.position = new Vector3(
      ...normalOffset(
        p.position[0],
        p.position[1],
        p.position[2],
        boardCfg.offset
      )
    )
    root.rotationQuaternion = null
    root.rotation.y = normalAngle(p.angle, boardCfg.angle)
    const s = normalScale(1, boardCfg.scale)
    root.scaling = new Vector3(s, s, s)
    root.getChildMeshes(false).forEach((m) => {
      m.receiveShadows = true
      ctx.shadowGen!.addShadowCaster(m)
    })
    // cfg.width/depth 是模型在 cfg.angle 姿态下的 XZ 尺寸；p.angle 额外旋转时需交换宽深
    const swapWidthDepth = Math.abs(Math.sin(p.angle)) > 0.707
    attachHitbox(
      ctx,
      p.position[0],
      p.position[2],
      boardCfg,
      1,
      new Color3(0.5, 0.5, 1),
      p.position[1],
      swapWidthDepth
    )
  }

  for (const [i, p] of bottomWallPositions.entries()) await placeBoard(p, i)
  const lLen = leftWallPositions.length
  for (const [j, p] of leftWallPositions.entries())
    await placeBoard(p, lLen - 1 - j)
}

// ─── 打印机 ──────────────────────────────────────────────────────────────────

export async function loadPrinter(
  ctx: OfficeContext,
  worldX: number,
  worldZ: number
): Promise<void> {
  if (ctx.disposed || !ctx.scene || !ctx.shadowGen) return
  const cfg = MESHES_CONFIG.printer
  try {
    const result = await SceneLoader.ImportMeshAsync(
      '',
      '',
      resolveModelUrl(cfg.file),
      ctx.scene
    )
    if (ctx.disposed) return
    const meshes = result.meshes as Mesh[]
    const root = meshes[0]
    root.position = new Vector3(
      ...normalOffset(worldX, cfg.groundOffset ?? 0, worldZ, cfg.offset)
    )
    root.rotationQuaternion = null
    root.rotation.y = normalAngle(0, cfg.angle)
    const s = normalScale(1, cfg.scale)
    root.scaling = new Vector3(s, s, s)
    meshes.forEach((m) => {
      m.receiveShadows = true
      ctx.shadowGen!.addShadowCaster(m)
    })
    attachHitbox(ctx, worldX, worldZ, cfg, 1, new Color3(1, 0.5, 0))
  } catch (err) {
    if (!ctx.disposed) console.warn('Failed to load printer:', err)
  }
}

// ─── 书架 ────────────────────────────────────────────────────────────────────

export async function loadBookshelf(
  ctx: OfficeContext,
  worldX: number,
  worldZ: number
): Promise<void> {
  if (ctx.disposed || !ctx.scene || !ctx.shadowGen) return
  const cfg = MESHES_CONFIG.bookshelf
  if (!cfg) return
  try {
    const result = await SceneLoader.ImportMeshAsync(
      '',
      '',
      resolveModelUrl(cfg.file),
      ctx.scene
    )
    if (ctx.disposed) return
    const meshes = result.meshes as Mesh[]
    const root = meshes[0]
    root.position = new Vector3(
      ...normalOffset(worldX, cfg.groundOffset, worldZ, cfg.offset)
    )
    root.rotationQuaternion = null
    root.rotation.y = normalAngle(0, cfg.angle)
    const s = normalScale(1, cfg.scale)
    root.scaling = new Vector3(s, s, s)
    meshes.forEach((m) => {
      m.receiveShadows = true
      ctx.shadowGen!.addShadowCaster(m)
    })
    attachHitbox(ctx, worldX, worldZ, cfg, 1, new Color3(0.3, 0.8, 1))
  } catch (err) {
    if (!ctx.disposed) console.warn('Failed to load bookshelf:', err)
  }
}

// ─── 冰箱 ────────────────────────────────────────────────────────────────────

export async function loadFridge(
  ctx: OfficeContext,
  worldX: number,
  worldZ: number
): Promise<void> {
  if (ctx.disposed || !ctx.scene || !ctx.shadowGen) return
  const cfg = MESHES_CONFIG.fridge
  if (!cfg) return
  try {
    const result = await SceneLoader.ImportMeshAsync(
      '',
      '',
      resolveModelUrl(cfg.file),
      ctx.scene
    )
    if (ctx.disposed) return
    const meshes = result.meshes as Mesh[]
    const root = meshes[0]
    root.position = new Vector3(
      ...normalOffset(worldX, cfg.groundOffset, worldZ, cfg.offset)
    )
    root.rotationQuaternion = null
    root.rotation.y = normalAngle(0, cfg.angle)
    const s = normalScale(1, cfg.scale)
    root.scaling = new Vector3(s, s, s)
    meshes.forEach((m) => {
      m.receiveShadows = true
      ctx.shadowGen!.addShadowCaster(m)
    })
    attachHitbox(ctx, worldX, worldZ, cfg, 1, new Color3(0.2, 0.9, 0.6))
  } catch (err) {
    if (!ctx.disposed) console.warn('Failed to load fridge:', err)
  }
}

// ─── 沙发 ────────────────────────────────────────────────────────────────────

export async function loadSofa(
  ctx: OfficeContext,
  worldX: number,
  worldZ: number
): Promise<void> {
  if (ctx.disposed || !ctx.scene || !ctx.shadowGen) return
  const cfg = MESHES_CONFIG.sofa
  if (!cfg) return
  try {
    const result = await SceneLoader.ImportMeshAsync(
      '',
      '',
      resolveModelUrl(cfg.file),
      ctx.scene
    )
    if (ctx.disposed) return
    const meshes = result.meshes as Mesh[]
    const root = meshes[0]
    root.position = new Vector3(
      ...normalOffset(worldX, cfg.groundOffset ?? 0, worldZ, cfg.offset)
    )
    root.rotationQuaternion = null
    root.rotation.y = normalAngle(0, cfg.angle)
    const s = normalScale(1, cfg.scale)
    root.scaling = new Vector3(s, s, s)
    meshes.forEach((m) => {
      m.receiveShadows = true
      ctx.shadowGen!.addShadowCaster(m)
    })
    attachHitbox(ctx, worldX, worldZ, cfg, 1, new Color3(1, 0, 1))
  } catch (err) {
    if (!ctx.disposed) console.warn('Failed to load sofa:', err)
  }
}

// ─── 品牌文字（3D 标牌，贴在侧墙打印机上方）──────────────────────────────────

export function loadBrandText(
  ctx: OfficeContext,
  _printerX: number,
  _printerZ: number
): void {
  if (!ctx.scene) return
  const sc = ctx.scene
  const signY = 8
  // 紧贴侧墙（X=0 wall）
  const signX = 0.02
  const signZ = 20

  // 文字平面，宽大一些，无背板，直接贴墙
  const texW = 2048
  const texH = 384
  const planeW = 20
  const planeH = planeW * (texH / texW)
  const textPlane = MeshBuilder.CreatePlane(
    'brandTextPlane',
    { width: planeW, height: planeH, sideOrientation: Mesh.DOUBLESIDE },
    sc
  )
  textPlane.position = new Vector3(signX, signY, signZ)
  textPlane.rotation.y = -Math.PI / 2
  textPlane.isPickable = false

  const tex = new DynamicTexture(
    'brandTex',
    { width: texW, height: texH },
    sc,
    true
  )
  const canvas2d = tex.getContext() as CanvasRenderingContext2D
  canvas2d.clearRect(0, 0, texW, texH)

  // 刻字风格：深色内凹阴影 + 亮色高光，模拟浮雕效果
  const text = 'ClawGoal Office'
  let fontSize = 220
  canvas2d.font = `900 ${fontSize}px Arial`
  while (fontSize > 60 && canvas2d.measureText(text).width > texW - 60) {
    fontSize -= 6
    canvas2d.font = `900 ${fontSize}px Arial`
  }
  canvas2d.textAlign = 'center'
  canvas2d.textBaseline = 'middle'
  // 内凹阴影（右下深色）
  canvas2d.shadowOffsetX = 6
  canvas2d.shadowOffsetY = 6
  canvas2d.shadowBlur = 10
  canvas2d.shadowColor = 'rgba(0,0,0,0.6)'
  canvas2d.fillStyle = 'rgba(80,75,100,0.9)'
  canvas2d.fillText(text, texW / 2, texH / 2)
  // 高光（左上亮色）
  canvas2d.shadowOffsetX = -3
  canvas2d.shadowOffsetY = -3
  canvas2d.shadowBlur = 6
  canvas2d.shadowColor = 'rgba(255,255,255,0.5)'
  canvas2d.fillStyle = 'rgba(200,195,220,1)'
  canvas2d.fillText(text, texW / 2, texH / 2)
  canvas2d.shadowOffsetX = 0
  canvas2d.shadowOffsetY = 0
  canvas2d.shadowBlur = 0
  tex.update()

  const textMat = new StandardMaterial('brandTextMat', sc)
  textMat.diffuseTexture = tex
  textMat.emissiveTexture = tex
  textMat.disableLighting = true
  textMat.backFaceCulling = false
  textMat.diffuseTexture.hasAlpha = true
  textMat.useAlphaFromDiffuseTexture = true
  textPlane.material = textMat
}

// ─── 植物（批量，从 ctx.materials 读取位置）────────────────────────────────

export async function loadHouseplants(ctx: OfficeContext): Promise<void> {
  if (ctx.disposed || !ctx.scene || !ctx.shadowGen) return
  const hpCfg = MESHES_CONFIG.plant
  const plantMats = ctx.materials.filter((m) => m.type === 'plant')
  try {
    const container = await SceneLoader.LoadAssetContainerAsync(
      resolveModelUrl(hpCfg.file),
      '',
      ctx.scene
    )
    for (const [i, pMat] of plantMats.entries()) {
      if (ctx.disposed) return
      const scale = pMat.scaleMultiplier ?? 1.5
      const angle = pMat.angle ?? 0
      const inst = container.instantiateModelsToScene((n) => `plant_${i}_${n}`)
      const root = inst.rootNodes[0] as TransformNode
      if (!root) continue
      const scaledOffset: [number, number, number] = [
        hpCfg.offset[0] * scale,
        hpCfg.offset[1] * scale,
        hpCfg.offset[2] * scale,
      ]
      const groundY = (hpCfg.groundOffset ?? 0) * scale
      root.position = new Vector3(
        ...normalOffset(pMat.x, groundY, pMat.z, scaledOffset)
      )
      root.rotationQuaternion = null
      root.rotation.y = normalAngle(angle, hpCfg.angle)
      const plantScale = normalScale(scale, hpCfg.scale)
      root.scaling = new Vector3(plantScale, plantScale, plantScale)
      root.getChildMeshes(false).forEach((m) => {
        m.receiveShadows = true
        ctx.shadowGen!.addShadowCaster(m)
      })
      attachHitbox(ctx, pMat.x, pMat.z, hpCfg, scale, new Color3(0.2, 1, 0))
    }
  } catch (err) {
    if (!ctx.disposed) console.warn('Failed to load plants:', err)
  }
}
