<template>
  <div v-if="loading" class="loading-overlay">
    <div class="loading-content">
      <div class="cube-wrapper mb-6">
        <div class="cube-loader">
          <div class="cube-face front"></div>
          <div class="cube-face back"></div>
          <div class="cube-face right"></div>
          <div class="cube-face left"></div>
          <div class="cube-face top"></div>
          <div class="cube-face bottom"></div>
        </div>
      </div>

      <div class="loading-text text-center">
        <div
          v-if="loadedCount < totalCount && totalCount > 0"
          class="tracking-wide text-gray-800 dark:text-gray-100 uppercase float-text"
        >
          {{
            t('claw.office.officeLoadingAgents', {
              loaded: loadedCount,
              total: totalCount,
            })
          }}
        </div>
        <div
          v-else
          class="tracking-wide text-gray-800 dark:text-gray-100 uppercase float-text"
        >
          {{ t('claw.office.officeLoading') }}
        </div>

        <div v-if="totalCount > 0" class="progress-container mt-6">
          <div class="progress-bar-3d">
            <div
              class="progress-fill-3d transition-all duration-300 ease-out"
              :style="{
                width: `${Math.round((loadedCount / totalCount) * 100)}%`,
              }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  loading: boolean
  loadedCount: number
  totalCount: number
}>()
</script>

<style scoped>
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  z-index: 50;
  transition: opacity 0.3s;
}

:deep(.dark) .loading-overlay {
  background: rgba(15, 23, 42, 0.5);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  perspective: 1000px;
}

/* 3D Floating Text */
.float-text {
  text-shadow:
    0px 1px 0px #ccc,
    0px 2px 0px #c9c9c9,
    0px 3px 0px #bbb,
    0px 4px 0px #b9b9b9,
    0px 5px 0px #aaa,
    0px 6px 1px rgba(0, 0, 0, 0.1),
    0px 0px 5px rgba(0, 0, 0, 0.1),
    0px 1px 3px rgba(0, 0, 0, 0.3),
    0px 3px 5px rgba(0, 0, 0, 0.2),
    0px 5px 10px rgba(0, 0, 0, 0.25),
    0px 10px 10px rgba(0, 0, 0, 0.2),
    0px 20px 20px rgba(0, 0, 0, 0.15);
}
:deep(.dark) .float-text {
  text-shadow:
    0px 1px 0px #444,
    0px 2px 0px #333,
    0px 3px 0px #222,
    0px 4px 0px #111,
    0px 5px 1px rgba(0, 0, 0, 0.5),
    0px 0px 5px rgba(0, 0, 0, 0.5),
    0px 1px 3px rgba(0, 0, 0, 0.6),
    0px 3px 5px rgba(0, 0, 0, 0.5),
    0px 5px 10px rgba(0, 0, 0, 0.6),
    0px 10px 10px rgba(0, 0, 0, 0.5);
}

/* 3D Progress Bar */
.progress-container {
  width: 240px;
  perspective: 400px;
}

.progress-bar-3d {
  width: 100%;
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  box-shadow:
    inset 0 2px 3px rgba(0, 0, 0, 0.2),
    0 2px 0 rgba(255, 255, 255, 0.8);
  overflow: hidden;
  position: relative;
  transform: rotateX(20deg);
  transform-style: preserve-3d;
}

:deep(.dark) .progress-bar-3d {
  background: #1e293b;
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.6),
    0 1px 0 rgba(255, 255, 255, 0.05);
}

.progress-fill-3d {
  height: 100%;
  background: linear-gradient(
    to bottom,
    var(--color-primary-400),
    var(--color-primary-600),
    var(--color-primary-700)
  );
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.5),
    inset 0 -1px 2px rgba(0, 0, 0, 0.3);
  border-radius: 6px;
}

/* 3D Cube Loader */
.cube-wrapper {
  width: 60px;
  height: 60px;
  perspective: 400px;
}

.cube-loader {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  animation: rotateCube 2.5s infinite ease-in-out;
}

.cube-face {
  position: absolute;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.05);
  opacity: 0.9;
}

:deep(.dark) .cube-face {
  background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.3);
}

.cube-face.front {
  transform: rotateY(0deg) translateZ(30px);
}
.cube-face.right {
  transform: rotateY(90deg) translateZ(30px);
}
.cube-face.back {
  transform: rotateY(180deg) translateZ(30px);
}
.cube-face.left {
  transform: rotateY(-90deg) translateZ(30px);
}
.cube-face.top {
  transform: rotateX(90deg) translateZ(30px);
}
.cube-face.bottom {
  transform: rotateX(-90deg) translateZ(30px);
}

@keyframes rotateCube {
  0% {
    transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg);
  }
  33% {
    transform: rotateX(180deg) rotateY(90deg) rotateZ(0deg);
  }
  66% {
    transform: rotateX(180deg) rotateY(270deg) rotateZ(90deg);
  }
  100% {
    transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg);
  }
}
</style>
