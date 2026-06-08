<template>
  <a-modal
    width="min(600px, 90vw)"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('config.proxyTestTitle')"
    :ok-text="$t('config.proxyTest')"
    :cancel-text="$t('common.cancel')"
    :confirm-loading="testing"
    destroy-on-close
    @ok="doTest"
    @cancel="handleCancel"
  >
    <div class="space-y-3 py-2">
      <a-form layout="vertical">
        <a-form-item
          :label="$t('config.proxyTestUrlLabel')"
          v-bind="urlError ? { validateStatus: 'error', help: urlError } : {}"
        >
          <a-input
            v-model:value="testUrl"
            :placeholder="$t('config.proxyTestUrlPlaceholder')"
            @press-enter="doTest"
          />
        </a-form-item>
      </a-form>
      <div v-if="result" :class="result.ok ? 'text-success' : 'text-error'">
        {{ result.message }}
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testProxy, type ProxyConfig } from '../../../api/config'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  proxy: ProxyConfig | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const testUrl = ref('https://www.google.com')
const urlError = ref('')
const testing = ref(false)
const result = ref<{ ok: boolean; message: string } | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      testUrl.value = 'https://www.google.com'
      urlError.value = ''
      result.value = null
    }
  }
)

async function doTest() {
  if (!testUrl.value.trim()) {
    urlError.value = t('config.proxyTestUrlRequired')
    return
  }
  urlError.value = ''
  testing.value = true
  result.value = null
  try {
    const res = await testProxy(props.proxy!.name, testUrl.value.trim())
    result.value = {
      ok: res.ok,
      message: t(
        res.ok ? 'config.proxyTestSuccess' : 'config.proxyTestFailed',
        {
          status: res.statusCode,
          error:
            res.error ??
            (res.statusCode != null
              ? `HTTP ${res.statusCode}`
              : 'Unknown error'),
        }
      ),
    }
  } catch (err: any) {
    result.value = {
      ok: false,
      message: t('config.proxyTestFailed', {
        error: err?.response?.data?.message ?? err?.message ?? 'Unknown error',
      }),
    }
  } finally {
    testing.value = false
  }
}

function handleCancel() {
  emit('update:open', false)
}
</script>
