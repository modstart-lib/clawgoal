// GLB URL 由 load.ts 通过 import.meta.glob 懒加载解析，此处不再静态导入
import type { MeshesConfig } from './types'

// 参数由 scripts/sync-mesh.mjs 脚本自动计算（node scripts/sync-mesh.mjs）
// width/depth 为应用 scale+angle 旋转后的世界空间占地尺寸（worldX / worldZ）
// height 为 Y 轴高度（仅受 scale 影响，不随 angle 变化）
// offset = [-rotated_center_X, -center_Y, -rotated_center_Z]（XYZ 全居中，经 scale+angle+offset 后物体位于世界原点）
// groundOffset = -local_Y_bottom - offset[1]（物体放置在地面时，模型原点距地面的距离）

export const MESHES_CONFIG: MeshesConfig = {
  desktop: {
    name: 'desk',
    enable: true,
    file: 'StandingDesk.glb',
    angle: Math.PI / 2,
    scale: 2,
    // StandingDesk.glb: local bbox at scale 2: X=[-2.912, 1.088]  Y=[0.001, 3.459]  Z=[-14.56, -11.727]
    // world footprint after angle=+PI*0.5: width(worldX)=2.833  depth(worldZ)=4  height=3.458
    width: 2.833,
    depth: 4,
    height: 3.458,
    boxScale: [0.5, 1, 1],
    offset: [13.143, -1.73, -0.912],
    // groundOffset = -local_Y_bottom - offset[1] = -0.001 - (-1.73) = 1.729
    groundOffset: 1.729,
    animationsAll: [],
    animations: {},
  },
  fridge: {
    name: 'fridge',
    enable: true,
    file: 'CanFridge.glb',
    angle: 0,
    scale: 1,
    // CanFridge.glb: local bbox at scale 1: X=[4.192, 6.552]  Y=[-0.018, 4.367]  Z=[-0.708, 0.623]
    // world footprint after angle=0: width(worldX)=2.36  depth(worldZ)=1.331  height=4.385
    width: 2.36,
    depth: 1.331,
    height: 4.385,
    boxScale: [1, 1, 1],
    offset: [-5.372, -2.175, 0.043],
    // groundOffset = -local_Y_bottom - offset[1] = 0.018 - (-2.175) = 2.193
    groundOffset: 2.193,
    animationsAll: [],
    animations: {},
  },
  bookshelf: {
    name: 'bookshelf',
    enable: true,
    file: 'Bookshelf.glb',
    angle: -Math.PI / 2,
    scale: 1,
    // Bookshelf.glb: local bbox at scale 1: X=[-2.399, 2.442]  Y=[-2.357, 2.542]  Z=[-0.84, 0.824]
    // world footprint after angle=-PI*0.5: width(worldX)=1.664  depth(worldZ)=4.841  height=4.899
    width: 1.664,
    depth: 4.841,
    height: 4.899,
    boxScale: [1, 1, 1],
    offset: [-0.008, -0.092, -0.022],
    // groundOffset = -local_Y_bottom - offset[1] = 2.357 - (-0.092) = 2.449
    groundOffset: 2.449,
    animationsAll: [],
    animations: {},
  },
  printer: {
    name: 'printer',
    enable: true,
    file: 'OfficePrinterCopier.glb',
    angle: -Math.PI / 2,
    scale: 1.8,
    // OfficePrinterCopier.glb: local bbox at scale 1.8: X=[-2.221, 1.414]  Y=[-2.21, 1.841]  Z=[-0.661, 2.274]
    // world footprint after angle=-PI*0.5: width(worldX)=2.935  depth(worldZ)=3.635  height=4.051
    width: 2.935,
    depth: 3.635,
    height: 4.051,
    boxScale: [1, 1, 1],
    offset: [0.806, 0.185, 0.404],
    // groundOffset = -local_Y_bottom - offset[1] = 2.21 - (0.185) = 2.025
    groundOffset: 2.025,
    animationsAll: [],
    animations: {},
  },
  sofa: {
    name: 'sofa',
    enable: true,
    file: 'Sofa.glb',
    angle: Math.PI / 2,
    scale: 2,
    // Sofa.glb: local bbox at scale 2: X=[-4.032, 3.974]  Y=[-0.077, 2.827]  Z=[-1.339, 1.743]
    // world footprint after angle=+PI*0.5: width(worldX)=3.082  depth(worldZ)=8.005  height=2.905
    width: 3.082,
    depth: 8.005,
    height: 2.905,
    boxScale: [1, 1, 1],
    offset: [-0.202, -1.375, -0.029],
    // groundOffset = -local_Y_bottom - offset[1] = 0.077 - (-1.375) = 1.452
    groundOffset: 1.452,
    animationsAll: [],
    animations: {},
  },
  boards: [
    {
      name: 'board',
      enable: true,
      file: 'CorkBoard.glb',
      angle: 0,
      scale: 3,
      // CorkBoard.glb: local bbox at scale 3: X=[-0.213, 0.186]  Y=[-1.788, 1.272]  Z=[-2.704, 2.636]
      // world footprint after angle=0: width(worldX)=0.399  depth(worldZ)=5.34  height=3.06
      width: 0.399,
      depth: 5.34,
      height: 3.06,
      boxScale: [1, 1, 1],
      offset: [0.014, 0.258, 0.034],
      // groundOffset = -local_Y_bottom - offset[1] = 1.788 - (0.258) = 1.53
      groundOffset: 1.53,
      animationsAll: [],
      animations: {},
    },
    {
      name: 'wallArt03',
      enable: true,
      file: 'WallArt03.glb',
      angle: -Math.PI / 2,
      scale: 3,
      // WallArt03.glb: local bbox at scale 3: X=[-0.795, 0.825]  Y=[-1.335, 1.335]  Z=[-0.045, 0.045]
      // world footprint after angle=-PI*0.5: width(worldX)=0.09  depth(worldZ)=1.62  height=2.67
      width: 0.09,
      depth: 1.62,
      height: 2.67,
      boxScale: [1, 1, 1],
      offset: [0, 0, -0.015],
      // groundOffset = -local_Y_bottom - offset[1] = 1.335 - (0) = 1.335
      groundOffset: 1.335,
      animationsAll: [],
      animations: {},
    },
  ],
  plant: {
    name: 'houseplant',
    enable: true,
    file: 'Houseplant.glb',
    angle: 0,
    scale: 0.01,
    // Houseplant.glb: local bbox at scale 0.01: X=[-1.107, 1.17]  Y=[0.007, 1.994]  Z=[-0.993, 0.946]
    // world footprint after angle=0: width(worldX)=2.276  depth(worldZ)=1.939  height=1.987
    width: 2.276,
    depth: 1.939,
    height: 1.987,
    boxScale: [1, 1, 1],
    offset: [-0.032, -1.001, 0.024],
    // groundOffset = -local_Y_bottom - offset[1] = -0.007 - (-1.001) = 0.994
    groundOffset: 0.994,
    animationsAll: [],
    animations: {},
  },
}

export const OFFICE_CONFIG = {
  desktop: true,
  printer: true,
  bookshelf: true,
  fridge: true,
  sofa: true,
  boards: true,
  plants: true,
  brand: true,
  roamEnable: true,
  debug: false,
  agentRandomTest: false,
}

export const PALETTE = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#0ea5e9',
  '#f97316',
  '#06b6d4',
]
