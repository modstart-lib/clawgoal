<template>
  <a-modal
    :keyboard="false"
    :open="open"
    :footer="null"
    :width="'min(920px, 90vw)'"
    class="pb-cube-character-selector"
    :styles="{ body: { padding: 0, overflow: 'hidden', borderRadius: '8px' } }"
    centered
    @cancel="emit('update:open', false)"
  >
    <!-- custom header -->
    <template #title>
      <div class="flex items-center gap-2">
        <IconUserRound class="w-4 h-4" />
        {{ $t('claw.office.characterCustomize') }}
      </div>
    </template>
    <div
      class="flex overflow-hidden rounded-lg"
      style="height: min(600px, calc(90vh - 110px)); background: #0a0a1a"
    >
      <!-- Left: 3D viewport -->
      <div
        class="flex-1 min-w-0 h-full flex items-center justify-center overflow-hidden"
        style="container-type: size"
      >
        <div
          class="relative"
          style="width: min(100cqw, 100cqh); height: min(100cqw, 100cqh)"
        >
          <canvas ref="canvasRef" class="w-full h-full block touch-none" />
          <div
            v-if="loading"
            class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[rgba(10,10,26,0.85)]"
          >
            <div
              class="w-11 h-11 rounded-full border-[3px] border-white/10 border-t-[#7ee8a2] animate-spin"
            />
            <p class="text-sm tracking-widest text-[#7ee8a2]">
              Loading character…
            </p>
          </div>
          <!-- Face preview rounded-corner overlays (top-left, 90×90 CSS px) -->
          <template v-if="!loading">
            <!-- Decorative border frame -->
            <div
              class="absolute pointer-events-none"
              style="
                top: 12px;
                left: 12px;
                width: 90px;
                height: 90px;
                border-radius: 8px;
                border: 1.5px solid rgba(126, 232, 162, 0.5);
                z-index: 10;
              "
            />
            <!-- Corner masks: scene bg color (#141429) rounds off each corner -->
            <div
              class="absolute pointer-events-none"
              style="
                top: 12px;
                left: 12px;
                width: 8px;
                height: 8px;
                z-index: 9;
                background: radial-gradient(
                  circle 8px at 100% 100%,
                  transparent 100%,
                  #141429 100%
                );
              "
            />
            <div
              class="absolute pointer-events-none"
              style="
                top: 12px;
                left: 94px;
                width: 8px;
                height: 8px;
                z-index: 9;
                background: radial-gradient(
                  circle 8px at 0% 100%,
                  transparent 100%,
                  #141429 100%
                );
              "
            />
            <div
              class="absolute pointer-events-none"
              style="
                top: 94px;
                left: 12px;
                width: 8px;
                height: 8px;
                z-index: 9;
                background: radial-gradient(
                  circle 8px at 100% 0%,
                  transparent 100%,
                  #141429 100%
                );
              "
            />
            <div
              class="absolute pointer-events-none"
              style="
                top: 94px;
                left: 94px;
                width: 8px;
                height: 8px;
                z-index: 9;
                background: radial-gradient(
                  circle 8px at 0% 0%,
                  transparent 100%,
                  #141429 100%
                );
              "
            />
          </template>
        </div>
      </div>

      <!-- Right: config sidebar -->
      <div
        v-if="!loading"
        class="w-80 flex-shrink-0 h-full overflow-y-auto flex flex-col gap-3 p-4 bg-[rgba(12,12,30,0.97)] border-l border-[rgba(126,232,162,0.18)] shadow-[-6px_0_24px_rgba(0,0,0,0.5)]"
      >
        <!-- Actions row -->
        <div class="flex flex-col gap-1.5">
          <div class="flex gap-2">
            <div
              class="flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-[#0a1a10] cursor-pointer select-none bg-gradient-to-br from-[#7ee8a2] to-[#3dd68c] shadow-[0_2px_12px_rgba(126,232,162,0.35)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_4px_18px_rgba(126,232,162,0.5)]"
              @click="randomize"
            >
              <IconShuffle class="w-4 h-4" />
              {{ $t('claw.office.randomGenerate') }}
            </div>
            <div
              class="flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-[#0a1a10] cursor-pointer select-none bg-gradient-to-br from-[#7ee8a2] to-[#3dd68c] shadow-[0_2px_12px_rgba(126,232,162,0.35)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_4px_18px_rgba(126,232,162,0.5)]"
              :class="saving ? 'opacity-50 pointer-events-none' : ''"
              @click="handleSave"
            >
              <IconSave class="w-4 h-4" />
              {{ $t('claw.office.confirmSave') }}
            </div>
          </div>
          <a-select
            v-if="animationPreviewEnable"
            v-model:value="currentAnim"
            class="w-full"
            :options="animOptions"
            @change="onAnimChange"
          />
        </div>

        <!-- Hair Style -->
        <section class="flex flex-col gap-1.5">
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
          >
            <IconScissors class="w-3 h-3 flex-shrink-0" />
            Hair Style
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="opt in hairOptions"
              :key="opt.mesh ?? 'none'"
              class="w-[38px] h-[38px] p-0.5 rounded-lg border-2 cursor-pointer overflow-hidden transition-all duration-150 flex items-center justify-center flex-shrink-0 hover:scale-110 hover:bg-white/10"
              :class="
                currentOutfit.hair === opt.mesh
                  ? 'border-[#7ee8a2] bg-[rgba(126,232,162,0.12)]'
                  : 'border-transparent bg-white/5'
              "
              :title="opt.label"
              @click="setHair(opt.mesh)"
            >
              <img
                v-if="opt.icon"
                :src="opt.icon"
                class="w-full h-full object-contain rounded"
              />
              <span v-else class="text-xs text-white/35 leading-none">✕</span>
            </div>
          </div>
        </section>

        <!-- Tops -->
        <section class="flex flex-col gap-1.5">
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
          >
            <IconShirt class="w-3 h-3 flex-shrink-0" />
            Top
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="opt in topOptions"
              :key="opt.mesh ?? ''"
              class="w-[38px] h-[38px] p-0.5 rounded-lg border-2 cursor-pointer overflow-hidden transition-all duration-150 flex items-center justify-center flex-shrink-0 hover:scale-110 hover:bg-white/10"
              :class="
                currentOutfit.top === opt.mesh
                  ? 'border-[#7ee8a2] bg-[rgba(126,232,162,0.12)]'
                  : 'border-transparent bg-white/5'
              "
              :title="opt.label"
              @click="setTop(opt.mesh ?? '')"
            >
              <img
                :src="opt.icon ?? ''"
                class="w-full h-full object-contain rounded"
              />
            </div>
          </div>
        </section>

        <!-- Bottoms -->
        <section class="flex flex-col gap-1.5">
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
          >
            <IconLayers class="w-3 h-3 flex-shrink-0" />
            Bottom
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="opt in bottomOptions"
              :key="opt.mesh ?? ''"
              class="w-[38px] h-[38px] p-0.5 rounded-lg border-2 cursor-pointer overflow-hidden transition-all duration-150 flex items-center justify-center flex-shrink-0 hover:scale-110 hover:bg-white/10"
              :class="
                currentOutfit.bottom === opt.mesh
                  ? 'border-[#7ee8a2] bg-[rgba(126,232,162,0.12)]'
                  : 'border-transparent bg-white/5'
              "
              :title="opt.label"
              @click="setBottom(opt.mesh ?? '')"
            >
              <img
                :src="opt.icon ?? ''"
                class="w-full h-full object-contain rounded"
              />
            </div>
          </div>
        </section>

        <!-- Apron -->
        <section class="flex flex-col gap-1.5">
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
          >
            <IconChefHat class="w-3 h-3 flex-shrink-0" />
            Apron
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="opt in apronOptions"
              :key="opt.mesh ?? 'none'"
              class="w-[38px] h-[38px] p-0.5 rounded-lg border-2 cursor-pointer overflow-hidden transition-all duration-150 flex items-center justify-center flex-shrink-0 hover:scale-110 hover:bg-white/10"
              :class="
                currentOutfit.apron === opt.mesh
                  ? 'border-[#7ee8a2] bg-[rgba(126,232,162,0.12)]'
                  : 'border-transparent bg-white/5'
              "
              :title="opt.label"
              @click="setApron(opt.mesh)"
            >
              <img
                v-if="opt.icon"
                :src="opt.icon"
                class="w-full h-full object-contain rounded"
              />
              <span v-else class="text-xs text-white/35 leading-none">✕</span>
            </div>
          </div>
        </section>

        <!-- Beard -->
        <section class="flex flex-col gap-1.5">
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
          >
            <IconSparkles class="w-3 h-3 flex-shrink-0" />
            Beard
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="opt in beardOptions"
              :key="opt.mesh ?? 'none'"
              class="w-[38px] h-[38px] p-0.5 rounded-lg border-2 cursor-pointer overflow-hidden transition-all duration-150 flex items-center justify-center flex-shrink-0 hover:scale-110 hover:bg-white/10"
              :class="
                currentOutfit.beard === opt.mesh
                  ? 'border-[#7ee8a2] bg-[rgba(126,232,162,0.12)]'
                  : 'border-transparent bg-white/5'
              "
              :title="opt.label"
              @click="setBeard(opt.mesh)"
            >
              <img
                v-if="opt.icon"
                :src="opt.icon"
                class="w-full h-full object-contain rounded"
              />
              <span v-else class="text-xs text-white/35 leading-none">✕</span>
            </div>
          </div>
        </section>

        <!-- Accessory -->
        <section class="flex flex-col gap-1.5">
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
          >
            <IconGem class="w-3 h-3 flex-shrink-0" />
            Accessory
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="opt in accessoryOptions"
              :key="opt.mesh ?? 'none'"
              class="w-[38px] h-[38px] p-0.5 rounded-lg border-2 cursor-pointer overflow-hidden transition-all duration-150 flex items-center justify-center flex-shrink-0 hover:scale-110 hover:bg-white/10"
              :class="
                currentOutfit.accessory === opt.mesh
                  ? 'border-[#7ee8a2] bg-[rgba(126,232,162,0.12)]'
                  : 'border-transparent bg-white/5'
              "
              :title="opt.label"
              @click="setAccessory(opt.mesh)"
            >
              <img
                v-if="opt.icon"
                :src="opt.icon"
                class="w-full h-full object-contain rounded"
              />
              <span v-else class="text-xs text-white/35 leading-none">✕</span>
            </div>
          </div>
        </section>

        <!-- Held Item -->
        <section v-if="heldItemEnable" class="flex flex-col gap-1.5">
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
          >
            <IconSword class="w-3 h-3 flex-shrink-0" />
            Held Item
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="opt in itemOptions"
              :key="opt.mesh ?? 'none'"
              class="w-[38px] h-[38px] p-0.5 rounded-lg border-2 cursor-pointer overflow-hidden transition-all duration-150 flex items-center justify-center flex-shrink-0 hover:scale-110 hover:bg-white/10"
              :class="
                currentOutfit.item === opt.mesh
                  ? 'border-[#7ee8a2] bg-[rgba(126,232,162,0.12)]'
                  : 'border-transparent bg-white/5'
              "
              :title="opt.label"
              @click="setItem(opt.mesh)"
            >
              <img
                v-if="opt.icon"
                :src="opt.icon"
                class="w-full h-full object-contain rounded"
              />
              <span v-else class="text-xs text-white/35 leading-none">✕</span>
            </div>
          </div>
        </section>

        <!-- Eyes -->
        <section class="flex flex-col gap-1.5">
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
          >
            <IconEye class="w-3 h-3 flex-shrink-0" />
            Eyes
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="opt in EYE_OPTIONS"
              :key="opt.key ?? 'none'"
              class="relative w-[38px] h-[38px] p-0 rounded-lg border-2 cursor-pointer overflow-hidden transition-all duration-150 flex items-center justify-center flex-shrink-0 hover:scale-110 hover:bg-white/10"
              :class="
                currentOutfit.eyes === opt.key
                  ? 'border-[#7ee8a2] bg-[rgba(126,232,162,0.12)]'
                  : 'border-transparent bg-white/5'
              "
              :title="opt.label"
              @click="setEyes(opt.key)"
            >
              <div
                v-if="opt.key && eyesTextureUrl"
                class="absolute inset-0 rounded-[inherit]"
                :style="{
                  backgroundImage: `url(${eyesTextureUrl})`,
                  backgroundSize: '152px 152px',
                  backgroundPosition: `${-opt.col * 38 - 2}px ${-opt.row * 38 - 2}px`,
                  backgroundRepeat: 'no-repeat',
                }"
              />
              <span v-else class="text-xs text-white/35 leading-none">✕</span>
            </div>
          </div>
        </section>

        <!-- Clothes Colour -->
        <section class="flex flex-col gap-1.5">
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
          >
            <IconPalette class="w-3 h-3 flex-shrink-0" />
            Top Color
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="c in CLOTHES_COLORS"
              :key="c.hex"
              class="w-[22px] h-[22px] rounded-[5px] border-2 cursor-pointer flex-shrink-0 hover:scale-110 transition-all duration-150"
              :class="
                currentOutfit.topColor === c.hex
                  ? 'border-[#7ee8a2]'
                  : 'border-transparent'
              "
              :style="{ backgroundColor: c.hex }"
              :title="c.name"
              @click="setTopColor(c.hex)"
            />
          </div>
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5 mt-1"
          >
            <IconPalette class="w-3 h-3 flex-shrink-0" />
            Bottom Color
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="c in CLOTHES_COLORS"
              :key="c.hex"
              class="w-[22px] h-[22px] rounded-[5px] border-2 cursor-pointer flex-shrink-0 hover:scale-110 transition-all duration-150"
              :class="
                currentOutfit.bottomColor === c.hex
                  ? 'border-[#7ee8a2]'
                  : 'border-transparent'
              "
              :style="{ backgroundColor: c.hex }"
              :title="c.name"
              @click="setBottomColor(c.hex)"
            />
          </div>
          <label
            class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5 mt-1"
          >
            <IconPalette class="w-3 h-3 flex-shrink-0" />
            Apron Color
          </label>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="c in CLOTHES_COLORS"
              :key="c.hex"
              class="w-[22px] h-[22px] rounded-[5px] border-2 cursor-pointer flex-shrink-0 hover:scale-110 transition-all duration-150"
              :class="
                currentOutfit.apronColor === c.hex
                  ? 'border-[#7ee8a2]'
                  : 'border-transparent'
              "
              :style="{ backgroundColor: c.hex }"
              :title="c.name"
              @click="setApronColor(c.hex)"
            />
          </div>
        </section>

        <!-- Skin & Hair Colour -->
        <div class="flex flex-col gap-3 mt-1">
          <div class="flex flex-col gap-1.5">
            <label
              class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
            >
              <IconPersonStanding class="w-3 h-3 flex-shrink-0" />
              Skin
            </label>
            <div class="flex flex-wrap gap-1">
              <div
                v-for="(s, i) in skintoneList"
                :key="s"
                class="w-[26px] h-[26px] p-0.5 rounded-[6px] border-2 cursor-pointer overflow-hidden transition-all duration-150 flex-shrink-0 hover:scale-110"
                :class="
                  currentOutfit.skintone === s
                    ? 'border-[#7ee8a2]'
                    : 'border-transparent bg-white/5'
                "
                :title="`Skintone ${i + 1}`"
                @click="setSkin(s)"
              >
                <img
                  v-if="skintoneUrls[s]"
                  :src="skintoneUrls[s]"
                  class="w-full h-full object-cover rounded-[3px] block"
                />
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label
              class="text-[0.65rem] uppercase tracking-widest text-[#889] flex items-center gap-1.5"
            >
              <IconDroplets class="w-3 h-3 flex-shrink-0" />
              Hair Color
            </label>
            <div class="flex flex-wrap gap-1">
              <div
                v-for="(h, i) in hairColorList"
                :key="h"
                class="w-[26px] h-[26px] p-0.5 rounded-[6px] border-2 cursor-pointer overflow-hidden transition-all duration-150 flex-shrink-0 hover:scale-110"
                :class="
                  currentOutfit.hairColor === h
                    ? 'border-[#7ee8a2]'
                    : 'border-transparent bg-white/5'
                "
                :title="`Hair ${i + 1}`"
                @click="setHairColor(h)"
              >
                <img
                  v-if="hairColorUrls[h]"
                  :src="hairColorUrls[h]"
                  class="w-full h-full object-cover rounded-[3px] block"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import { AxesViewer } from '@babylonjs/core/Debug/axesViewer'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  withDefaults,
} from 'vue'
import IconChefHat from '~icons/lucide/chef-hat'
import IconDroplets from '~icons/lucide/droplets'
import IconEye from '~icons/lucide/eye'
import IconGem from '~icons/lucide/gem'
import IconLayers from '~icons/lucide/layers'
import IconPalette from '~icons/lucide/palette'
import IconPersonStanding from '~icons/lucide/person-standing'
import IconSave from '~icons/lucide/save'
import IconScissors from '~icons/lucide/scissors'
import IconShirt from '~icons/lucide/shirt'
import IconShuffle from '~icons/lucide/shuffle'
import IconSparkles from '~icons/lucide/sparkles'
import IconSword from '~icons/lucide/sword'
import IconUserRound from '~icons/lucide/user-round'
import {
  AssetCategory,
  buildRandomConfig,
  CharacterConfig,
  CLOTHES_COLORS,
  createCubeCharacterFactory,
  CubeCharacterBot,
  EYE_OPTIONS,
} from 'cube-character'

// ── Props / emits ─────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    open: boolean
    /** 上次保存的配置；再次打开编辑器时用于恢复选项与 3D 状态 */
    initialConfig?: CharacterConfig | null
    /** 为 true 时在场景中绘制世界坐标轴等调试信息 */
    debug?: boolean
    /** 为 true 时显示动画预览下拉选择器，默认不显示 */
    animationPreviewEnable?: boolean
    /** 为 true 时显示手持道具选择区域，默认不显示 */
    heldItemEnable?: boolean
  }>(),
  {
    debug: false,
    animationPreviewEnable: false,
    heldItemEnable: false,
    initialConfig: null,
  }
)

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', payload: { config: CharacterConfig; image: string }): void
}>()

const charFactory = shallowRef<ReturnType<
  typeof createCubeCharacterFactory
> | null>(null)

const assetsData = ref<AssetCategory[]>([])
const bot = ref<CubeCharacterBot | null>(null)
const eyesTextureUrl = ref('')
const assetsReady = ref(false)

// ── Icon option lists ─────────────────────────────────────────────────────────

interface IconOption {
  mesh: string | null
  icon: string | null
  label: string
}

function categoryOptions(name: string): IconOption[] {
  return (assetsData.value.find((c) => c.name === name)?.records ?? []).map(
    (r) => ({
      mesh: r.value,
      icon: r.image ?? null,
      label: r.title,
    })
  )
}

const hairOptions = computed<IconOption[]>(() => categoryOptions('hair'))
const topOptions = computed<IconOption[]>(() => categoryOptions('top'))
const bottomOptions = computed<IconOption[]>(() => categoryOptions('bottom'))
const beardOptions = computed<IconOption[]>(() => categoryOptions('beard'))
const accessoryOptions = computed<IconOption[]>(() =>
  categoryOptions('accessory')
)
const apronOptions = computed<IconOption[]>(() => categoryOptions('apron'))
const itemOptions = computed<IconOption[]>(() => categoryOptions('item'))

const skintoneUrls = computed(() =>
  Object.fromEntries(
    (assetsData.value.find((c) => c.name === 'skintone')?.records ?? []).map(
      (r) => [r.value, r.image ?? '']
    )
  )
)

const skintoneList = computed(() =>
  (assetsData.value.find((c) => c.name === 'skintone')?.records ?? []).map(
    (r) => r.value as string
  )
)

const hairColorUrls = computed(() =>
  Object.fromEntries(
    (assetsData.value.find((c) => c.name === 'hairColor')?.records ?? []).map(
      (r) => [r.value, r.image ?? '']
    )
  )
)

const hairColorList = computed(() =>
  (assetsData.value.find((c) => c.name === 'hairColor')?.records ?? []).map(
    (r) => r.value as string
  )
)

// ── Component state ───────────────────────────────────────────────────────────

const canvasRef = ref<HTMLCanvasElement | null>(null)
const engine = shallowRef<Engine | null>(null)
const babylonSceneRef = shallowRef<Scene | null>(null)
let debugAxesViewer: AxesViewer | null = null
let charRenderFn: (() => void) | null = null
let charResizeHandler: (() => void) | null = null
let disposed = false
const loading = ref(true)
const saving = ref(false)
const currentAnim = ref('')

const currentOutfit = ref<CharacterConfig>({
  hair: null,
  top: '',
  bottom: '',
  accessory: null,
  beard: null,
  apron: null,
  item: null,
  eyes: 'EYES_00',
  skintone: 'Skintone_1',
  hairColor: 'Haircolour_01',
  topColor: '#607090',
  bottomColor: '#384060',
  apronColor: '#384060',
})

const animOptions = computed(() =>
  (bot.value?.animationNames ?? []).map((a) => ({ label: a, value: a }))
)

// ── Actions ───────────────────────────────────────────────────────────────────

async function randomize() {
  const outfit = charFactory.value?.randomConfig() ?? buildRandomConfig()
  currentOutfit.value = outfit
  await bot.value?.update(outfit)
}

function setHair(hair: string | null) {
  currentOutfit.value = { ...currentOutfit.value, hair }
  void bot.value?.update(currentOutfit.value)
}

function setTop(top: string) {
  currentOutfit.value = { ...currentOutfit.value, top }
  void bot.value?.update(currentOutfit.value)
}

function setBottom(bottom: string) {
  currentOutfit.value = { ...currentOutfit.value, bottom }
  void bot.value?.update(currentOutfit.value)
}

function setBeard(beard: string | null) {
  currentOutfit.value = { ...currentOutfit.value, beard }
  void bot.value?.update(currentOutfit.value)
}

function setAccessory(accessory: string | null) {
  currentOutfit.value = { ...currentOutfit.value, accessory }
  void bot.value?.update(currentOutfit.value)
}

function setApron(apron: string | null) {
  currentOutfit.value = { ...currentOutfit.value, apron }
  void bot.value?.update(currentOutfit.value)
}

function setItem(item: string | null) {
  currentOutfit.value = { ...currentOutfit.value, item }
  void bot.value?.update(currentOutfit.value)
}

async function setEyes(eyes: string | null) {
  currentOutfit.value = { ...currentOutfit.value, eyes }
  await bot.value?.update(currentOutfit.value)
}

function setTopColor(hex: string) {
  currentOutfit.value = { ...currentOutfit.value, topColor: hex }
  void bot.value?.update(currentOutfit.value)
}

function setBottomColor(hex: string) {
  currentOutfit.value = { ...currentOutfit.value, bottomColor: hex }
  void bot.value?.update(currentOutfit.value)
}

function setSkin(skintone: string) {
  currentOutfit.value = { ...currentOutfit.value, skintone }
  void bot.value?.update(currentOutfit.value)
}

function setApronColor(hex: string) {
  currentOutfit.value = { ...currentOutfit.value, apronColor: hex }
  void bot.value?.update(currentOutfit.value)
}

function setHairColor(hairColor: string) {
  currentOutfit.value = { ...currentOutfit.value, hairColor }
  void bot.value?.update(currentOutfit.value)
}

function playAnimation(name: string) {
  bot.value?.animate(name)
  currentAnim.value = name
}

function onAnimChange(v: string) {
  playAnimation(v)
}

/** 世界坐标轴调试：置于地面附近，与 AxesViewer 默认朝向一致（X 红 / Y 绿 / Z 蓝） */
function applyDebugAxes(scene: Scene | null, enabled: boolean) {
  if (debugAxesViewer) {
    debugAxesViewer.dispose()
    debugAxesViewer = null
  }
  if (!scene || !enabled) return
  debugAxesViewer = new AxesViewer(scene, 0.9, 2)
  debugAxesViewer.update(
    new Vector3(0, 0.02, 0),
    Vector3.Right(),
    Vector3.Up(),
    Vector3.Forward()
  )
}

async function handleSave() {
  if (!bot.value) return
  saving.value = true
  try {
    const image = await bot.value.snapshotFace(256)
    emit('save', { config: { ...currentOutfit.value }, image })
    emit('update:open', false)
  } finally {
    saving.value = false
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen || disposed) return
    await nextTick()
    if (disposed) return
    if (!bot.value) {
      // First open: create the bot
      loading.value = true
      try {
        engine.value = new Engine(canvasRef.value!, true, {
          adaptToDeviceRatio: true,
          premultipliedAlpha: false,
        })
        if (disposed) {
          engine.value.dispose()
          return
        }
        const babylonScene = new Scene(engine.value)
        babylonSceneRef.value = babylonScene
        charRenderFn = () => babylonScene.render()
        engine.value.runRenderLoop(charRenderFn)

        // Lights
        const ambient = new HemisphericLight(
          'ambient',
          new Vector3(0, 1, 0),
          babylonScene
        )
        ambient.intensity = 0.7
        ambient.groundColor = new Color3(0.2, 0.15, 0.25)
        const sun = new DirectionalLight(
          'sun',
          new Vector3(-1, -2, -1),
          babylonScene
        )
        sun.position = new Vector3(5, 10, 5)
        sun.intensity = 1.2

        // Camera
        const cam = new ArcRotateCamera(
          'cam',
          Math.PI / 2,
          Math.PI / 2.4,
          4.5,
          new Vector3(0, 1, 0),
          babylonScene
        )
        cam.attachControl(canvasRef.value!, true)
        cam.lowerRadiusLimit = 2
        cam.upperRadiusLimit = 10
        cam.wheelPrecision = 50
        cam.pinchPrecision = 50

        babylonScene.clearColor = new Color4(0.08, 0.08, 0.16, 1)
        babylonScene.setRenderingAutoClearDepthStencil(1, true)
        charFactory.value = createCubeCharacterFactory(babylonScene, {
          previewFace: true,
          rotate: [0, Math.PI, 0],
          heldItemEnable: props.heldItemEnable,
          // 生产打包后 import.meta.url 指向 /assets/chunk.js，会导致资产路径变成
          // /assets/assets/，此处在生产环境显式指定资产根路径以修复双重 assets 问题
          ...(import.meta.env.PROD
            ? { assetsBaseUrl: '/cube-character/' }
            : {}),
        })
        await charFactory.value.init()
        if (disposed) return
        assetsData.value = charFactory.value.assets()
        eyesTextureUrl.value = charFactory.value.getUrl(
          './assets/Textures/T_EyesTexture.png'
        )
        currentOutfit.value =
          props.initialConfig != null
            ? { ...props.initialConfig }
            : charFactory.value.randomConfig()
        assetsReady.value = true

        bot.value = await charFactory.value.generate(currentOutfit.value)
        if (disposed) return

        // Ground disc
        const scene = babylonScene
        const ground = MeshBuilder.CreateDisc(
          'ground',
          { radius: 0.5, tessellation: 48 },
          scene
        )
        ground.rotation.x = Math.PI / 2
        ground.position.y = -0.01
        const groundMat = new StandardMaterial('groundMat', scene)
        groundMat.diffuseColor = new Color3(0.12, 0.12, 0.2)
        groundMat.specularColor = Color3.Black()
        ground.material = groundMat
        ground.receiveShadows = true

        applyDebugAxes(babylonScene, props.debug)

        const defaultAnim = 'Armature|Stand_Pose'
        const firstName = bot.value.animationNames.includes(defaultAnim)
          ? defaultAnim
          : (bot.value.animationNames[0] ?? '')
        playAnimation(firstName)

        charResizeHandler = () => {
          engine.value?.resize()
          bot.value?.updateFaceViewport()
        }
        window.addEventListener('resize', charResizeHandler)
      } catch (err) {
        console.error('Failed to initialize character:', err)
      } finally {
        loading.value = false
        // Sidebar now appears, canvas width shrinks → re-sync Babylon buffer
        void nextTick(() => {
          engine.value?.resize()
          bot.value?.updateFaceViewport()
        })
      }
    } else {
      // Re-open: restore last saved config into UI + scene, then resize
      if (props.initialConfig != null && bot.value) {
        currentOutfit.value = { ...props.initialConfig }
        await bot.value.update(props.initialConfig)
      }
      window.dispatchEvent(new Event('resize'))
    }
  }
)

watch(
  () => props.debug,
  (enabled) => {
    applyDebugAxes(babylonSceneRef.value, enabled)
  }
)

onBeforeUnmount(() => {
  disposed = true
  applyDebugAxes(null, false)
  // Dispose scene first to cancel pending async texture/post-process operations
  if (babylonSceneRef.value) {
    try {
      babylonSceneRef.value.dispose()
    } catch {
      /* scene already disposed */
    }
    babylonSceneRef.value = null
  }
  if (charRenderFn && engine.value) {
    engine.value.stopRenderLoop(charRenderFn)
    charRenderFn = null
  }
  if (charResizeHandler) {
    window.removeEventListener('resize', charResizeHandler)
    charResizeHandler = null
  }
  charFactory.value?.destroy()
  if (engine.value) {
    try {
      engine.value.dispose()
    } catch {
      /* engine already disposed */
    }
    engine.value = null
  }
})
</script>
