<script setup lang="ts">
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'
import CodeEditor from './CodeEditor.vue'

interface KV {
  name: string
  value: string
}

interface HttpRequestData {
  url: string
  method: string
  requestType: 'json' | 'form'
  body: string
  formParams: KV[]
  headers: KV[]
}

const props = defineProps<{ modelValue: HttpRequestData }>()
const emit = defineEmits<{ 'update:modelValue': [value: HttpRequestData] }>()

function set(patch: Partial<HttpRequestData>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

// Headers
function addHeader() {
  set({
    headers: [...(props.modelValue.headers || []), { name: '', value: '' }],
  })
}
function removeHeader(i: number) {
  set({ headers: props.modelValue.headers.filter((_, idx) => idx !== i) })
}
function updateHeader(i: number, field: 'name' | 'value', val: string) {
  set({
    headers: props.modelValue.headers.map((h, idx) =>
      idx === i ? { ...h, [field]: val } : h
    ),
  })
}

// Form params
function addFormParam() {
  set({
    formParams: [
      ...(props.modelValue.formParams || []),
      { name: '', value: '' },
    ],
  })
}
function removeFormParam(i: number) {
  set({
    formParams: props.modelValue.formParams.filter((_, idx) => idx !== i),
  })
}
function updateFormParam(i: number, field: 'name' | 'value', val: string) {
  set({
    formParams: props.modelValue.formParams.map((p, idx) =>
      idx === i ? { ...p, [field]: val } : p
    ),
  })
}
</script>

<template>
  <div class="space-y-3">
    <!-- URL + Method -->
    <div class="flex gap-2">
      <a-select
        :value="modelValue.method || 'GET'"
        class="w-24"
        @change="(v: any) => set({ method: v })"
      >
        <a-select-option value="GET">GET</a-select-option>
        <a-select-option value="POST">POST</a-select-option>
        <a-select-option value="PUT">PUT</a-select-option>
        <a-select-option value="DELETE">DELETE</a-select-option>
        <a-select-option value="PATCH">PATCH</a-select-option>
      </a-select>
      <a-input
        :value="modelValue.url"
        placeholder="https://example.com/api"
        class="flex-1 font-mono"
        @change="set({ url: $event.target?.value ?? '' })"
      />
    </div>

    <!-- Request Type -->
    <div class="flex items-center gap-2">
      <span
        class="text-sm text-primary-600/80 dark:text-primary-400/80 font-medium"
        >{{ $t('httpRequestBuilder.requestType') }}</span
      >
      <a-select
        :value="modelValue.requestType || 'json'"
        class="w-24"
        @change="(v: any) => set({ requestType: v })"
      >
        <a-select-option value="json">JSON</a-select-option>
        <a-select-option value="form">{{
          $t('httpRequestBuilder.requestTypeForm')
        }}</a-select-option>
      </a-select>
    </div>

    <!-- Headers -->
    <div
      class="space-y-3 p-4 bg-primary-50/50 dark:bg-primary-900/10 rounded-xl border border-gray-200 dark:border-gray-700 backdrop-blur-md"
    >
      <div class="flex items-center justify-between">
        <span
          class="text-[11px] font-bold uppercase tracking-wider text-primary-500/80 dark:text-primary-400/80"
          >{{ $t('httpRequestBuilder.requestHeaders') }}</span
        >
        <a-button type="primary" size="small" ghost @click="addHeader">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-3.5 h-3.5" aria-hidden="true" />
            {{ $t('httpRequestBuilder.addHeader') }}
          </div>
        </a-button>
      </div>
      <div
        v-for="(h, i) in modelValue.headers || []"
        :key="i"
        class="flex gap-3 items-center"
      >
        <a-input
          :value="h.name"
          :placeholder="$t('httpRequestBuilder.headerName')"
          class="font-mono bg-white/80 dark:bg-gray-900/50"
          @change="updateHeader(i, 'name', $event.target?.value ?? '')"
        />
        <a-input
          :value="h.value"
          :placeholder="$t('httpRequestBuilder.headerValue')"
          class="font-mono bg-white/80 dark:bg-gray-900/50 flex-1"
          @change="updateHeader(i, 'value', $event.target?.value ?? '')"
        />
        <a-button
          class="inline-flex items-center shrink-0 border-red-200 hover:border-red-400 hover:bg-red-50 text-red-500 transition-colors"
          danger
          @click="removeHeader(i)"
        >
          <Trash2 class="w-4 h-4" aria-hidden="true" />
        </a-button>
      </div>
    </div>

    <!-- Form Params -->
    <template v-if="modelValue.requestType === 'form'">
      <div
        class="space-y-3 p-4 bg-primary-50/50 dark:bg-primary-900/10 rounded-xl border border-gray-200 dark:border-gray-700 backdrop-blur-md"
      >
        <div class="flex items-center justify-between">
          <div
            class="text-[11px] font-bold uppercase tracking-wider text-primary-500/80 dark:text-primary-400/80"
          >
            {{ $t('httpRequestBuilder.formParams') }}
          </div>
          <a-button type="primary" size="small" ghost @click="addFormParam">
            <div class="inline-flex items-center gap-1">
              <Plus class="w-3.5 h-3.5" aria-hidden="true" />
              {{ $t('httpRequestBuilder.addFormParam') }}
            </div>
          </a-button>
        </div>
        <div
          v-for="(fp, i) in modelValue.formParams || []"
          :key="i"
          class="flex gap-3 items-center"
        >
          <a-input
            :value="fp.name"
            placeholder="name"
            class="font-mono bg-white/80 dark:bg-gray-900/50"
            @change="updateFormParam(i, 'name', $event.target?.value ?? '')"
          />
          <a-input
            :value="fp.value"
            placeholder="value"
            class="font-mono bg-white/80 dark:bg-gray-900/50 flex-1"
            @change="updateFormParam(i, 'value', $event.target?.value ?? '')"
          />
          <a-button
            class="inline-flex items-center shrink-0 border-red-200 hover:border-red-400 hover:bg-red-50 text-red-500 transition-colors"
            danger
            @click="removeFormParam(i)"
          >
            <Trash2 class="w-4 h-4" aria-hidden="true" />
          </a-button>
        </div>
      </div>
    </template>

    <!-- JSON Body -->
    <template v-else>
      <div
        class="text-[11px] font-bold uppercase tracking-wider text-primary-500/80 dark:text-primary-400/80 mb-1 px-1"
      >
        {{ $t('httpRequestBuilder.requestBody') }}
      </div>
      <CodeEditor
        :model-value="modelValue.body"
        language="json"
        height="120px"
        placeholder='{"key":"${VALUE}"}'
        @update:model-value="set({ body: $event })"
      />
    </template>
  </div>
</template>
