<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div
    class="page-not-found h-screen w-full flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50"
  >
    <div class="max-w-md text-center px-4">
      <div
        class="text-9xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-primary-700 mb-4 animate-pulse"
      >
        404
      </div>
      <h1 class="text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
        {{ $t('notFound.title') }}
      </h1>
      <p class="text-gray-500 dark:text-gray-400 mb-8">
        {{ $t('notFound.desc') }}
      </p>

      <button
        class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        @click="goHome"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        {{ $t('notFound.backHome') }}
      </button>
    </div>
  </div>
</template>
