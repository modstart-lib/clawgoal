export const ok = (data: any) => ({ code: 0, msg: 'ok', data })
export const now = () => new Date().toISOString()
export const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString()
export const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 3600000).toISOString()
export const daysLater = (n: number) =>
  new Date(Date.now() + n * 86400000).toISOString()
