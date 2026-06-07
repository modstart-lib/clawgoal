/**
 * Agent Memory System
 *
 * 持久记忆和风格通过 paramDb 存储，支持多租户（userId 隔离）：
 *   Memory              — 全局记忆 Prompt
 *   AgentMemory:<id>    — 智能体私有记忆 Prompt
 *   Soul                — 全局风格定义
 *   AgentSoul:<id>      — 智能体私有风格定义
 *   User                — 用户情况描述
 */

import { paramDb } from '../../../backend/src/storage/store/userParam.js'

function memoryParamName(agentId?: number): string {
  return agentId != null ? `AgentMemory:${agentId}` : 'Memory'
}

function soulParamName(agentId?: number): string {
  return agentId != null ? `AgentSoul:${agentId}` : 'Soul'
}

export async function getMemory(
  tenantId: number,
  userId: number,
  agentId?: number
): Promise<string> {
  return (
    (await paramDb.getParam(tenantId, userId, memoryParamName(agentId))) ?? ''
  )
}

export async function setMemory(
  tenantId: number,
  userId: number,
  content: string,
  agentId?: number
): Promise<void> {
  await paramDb.setParam(tenantId, userId, memoryParamName(agentId), content)
}

export async function deleteMemory(
  tenantId: number,
  userId: number,
  agentId?: number
): Promise<void> {
  await paramDb.deleteParam(tenantId, userId, memoryParamName(agentId))
}

export async function getSoul(
  tenantId: number,
  userId: number,
  agentId?: number
): Promise<string> {
  return (
    (await paramDb.getParam(tenantId, userId, soulParamName(agentId))) ?? ''
  )
}

export async function setSoul(
  tenantId: number,
  userId: number,
  content: string,
  agentId?: number
): Promise<void> {
  await paramDb.setParam(tenantId, userId, soulParamName(agentId), content)
}

export async function deleteSoul(
  tenantId: number,
  userId: number,
  agentId?: number
): Promise<void> {
  await paramDb.deleteParam(tenantId, userId, soulParamName(agentId))
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function getUser(
  tenantId: number,
  userId: number
): Promise<string> {
  return (await paramDb.getParam(tenantId, userId, 'User')) ?? ''
}

export async function setUser(
  tenantId: number,
  userId: number,
  content: string
): Promise<void> {
  await paramDb.setParam(tenantId, userId, 'User', content)
}

export async function deleteUser(
  tenantId: number,
  userId: number
): Promise<void> {
  await paramDb.deleteParam(tenantId, userId, 'User')
}
