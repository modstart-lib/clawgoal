import { resolveApiPath } from './base'

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

/**
 * 获取随机头像（mock 模式下代理到 dicebear adventurer）
 * @param seed 可选种子，不传则随机
 * @returns data URL (image/svg+xml base64)
 */
export async function randomAvatar(seed?: string): Promise<string> {
  const s = seed || Math.random().toString(36).slice(2, 10)
  const res = await fetch(
    resolveApiPath(`/mock/randomAvatar?seed=${encodeURIComponent(s)}`)
  )
  if (!res.ok) throw new Error(`randomAvatar failed: ${res.status}`)
  return blobToDataUrl(await res.blob())
}

/**
 * 获取随机封面图（mock 模式下代理到 picsum.photos）
 * @param seed 可选种子，不传则随机
 * @returns data URL (image/jpeg base64)
 */
export async function randomCover(seed?: string): Promise<string> {
  const s = seed || Math.random().toString(36).slice(2, 10)
  const res = await fetch(
    resolveApiPath(`/mock/randomCover?seed=${encodeURIComponent(s)}`)
  )
  if (!res.ok) throw new Error(`randomCover failed: ${res.status}`)
  return blobToDataUrl(await res.blob())
}
