import {
  Color3,
  Color4,
  MeshBuilder,
  type Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'

export function buildStaticRoom(
  sc: Scene,
  floorWidth: number,
  floorDepth: number
): void {
  const floor = MeshBuilder.CreateBox(
    'staticFloor',
    { width: floorWidth, height: 0.2, depth: floorDepth },
    sc
  )
  floor.position = new Vector3(floorWidth / 2, -0.1, floorDepth / 2)
  const floorMat = new StandardMaterial('floorMat', sc)
  floorMat.diffuseColor = new Color3(0.3, 0.3, 0.32)
  floorMat.specularColor = new Color3(0.05, 0.05, 0.05)
  floor.material = floorMat
  floor.receiveShadows = true

  // ── Back wall (along X axis at Z=0) ──────────────
  const backWall = MeshBuilder.CreateBox(
    'backWall',
    { width: floorWidth, height: 10, depth: 0.3 },
    sc
  )
  backWall.position = new Vector3(floorWidth / 2, 5, -0.15)
  const backWallMat = new StandardMaterial('backWallMat', sc)
  backWallMat.diffuseColor = new Color3(0.45, 0.5, 0.55)
  backWallMat.specularColor = new Color3(0, 0, 0)
  backWallMat.ambientColor = new Color3(0.3, 0.3, 0.3)
  backWall.material = backWallMat
  backWall.receiveShadows = true

  // ── Side wall (along Z axis at X=0) ───
  const sideWall = MeshBuilder.CreateBox(
    'sideWall',
    { width: 0.3, height: 10, depth: floorDepth },
    sc
  )
  sideWall.position = new Vector3(-0.15, 5, floorDepth / 2)
  const sideWallMat = new StandardMaterial('sideWallMat', sc)
  sideWallMat.diffuseColor = new Color3(0.4, 0.45, 0.5)
  sideWallMat.specularColor = new Color3(0, 0, 0)
  sideWallMat.ambientColor = new Color3(0.3, 0.3, 0.3)
  sideWall.material = sideWallMat
  sideWall.receiveShadows = true
}

export function buildLowPolyEnvironment(
  sc: Scene,
  floorWidth: number,
  floorDepth: number
): void {
  sc.clearColor = new Color4(0.88, 0.93, 0.98, 1)

  const buildingMats = [
    new Color3(0.8, 0.85, 0.9),
    new Color3(0.72, 0.78, 0.85),
    new Color3(0.65, 0.72, 0.8),
    new Color3(0.9, 0.92, 0.95),
    new Color3(0.75, 0.8, 0.88),
  ].map((c, i) => {
    const mat = new StandardMaterial(`bldMat${i}`, sc)
    mat.diffuseColor = c
    mat.specularPower = 64
    mat.specularColor = new Color3(0.1, 0.1, 0.15)
    mat.emissiveColor = c.scale(0.15)
    return mat
  })

  const centerX = floorWidth / 2
  const centerZ = floorDepth / 2
  const numBuildings = 80
  const innerRadius = Math.max(floorWidth, floorDepth) + 20
  const outerRadius = innerRadius + 180

  for (let i = 0; i < numBuildings; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = innerRadius + Math.random() * (outerRadius - innerRadius)
    const bx = centerX + Math.cos(angle) * dist
    const bz = centerZ + Math.sin(angle) * dist
    const bw = 15 + Math.random() * 35
    const bd = 15 + Math.random() * 35
    const bh = 50 + Math.random() * 150
    const bld = MeshBuilder.CreateBox(
      `bld_${i}`,
      { width: bw, height: bh, depth: bd },
      sc
    )
    const yPos = -60 + bh / 2 - Math.random() * 40
    bld.position = new Vector3(bx, yPos, bz)
    bld.material = buildingMats[Math.floor(Math.random() * buildingMats.length)]
    bld.isPickable = false
  }
}
