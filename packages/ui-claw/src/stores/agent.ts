import { ref } from 'vue'
import type { Agent } from '@/types'
import {
  getAgents as _getAgents,
  refreshAgents as _refreshAgents,
} from '@/claw/api/agent'

const agents = ref<Agent[]>([])
const loading = ref(false)

const load = async (): Promise<void> => {
  if (agents.value.length > 0 || loading.value) return
  loading.value = true
  try {
    agents.value = await _getAgents()
  } finally {
    loading.value = false
  }
}

const refresh = async (): Promise<void> => {
  agents.value = []
  loading.value = true
  try {
    agents.value = await _refreshAgents()
  } finally {
    loading.value = false
  }
}

const getById = (id: string | number): Agent | undefined =>
  agents.value.find((a) => String(a.id) === String(id))

export const useAgentStore = () => ({ agents, loading, load, refresh, getById })
