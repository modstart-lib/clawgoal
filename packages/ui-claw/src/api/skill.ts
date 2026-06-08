import apiClient from './client'

export interface Skill {
  name: string
  version: string
  description: string
  tags: string[]
  requiredTools: string[]
  loadedAt: string
}

export interface SkillDetail extends Skill {
  promptContext: string
  skillDir: string
}

export const listSkills = async (): Promise<Skill[]> => {
  const res = await apiClient.post('/claw/skill/list')
  return res.data.data || []
}

export const getSkill = async (name: string): Promise<SkillDetail> => {
  const res = await apiClient.post('/claw/skill/detail', { name })
  return res.data.data
}

export const deleteSkill = async (name: string): Promise<void> => {
  await apiClient.post('/claw/skill/delete', { name })
}
