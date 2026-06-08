/**
 * Version comparison utility
 */

export const VersionUtil = {
  compare(v1: string, v2: string): number {
    const v1Arr = v1.replace(/^v/, '').split('.')
    const v2Arr = v2.replace(/^v/, '').split('.')
    for (let i = 0; i < Math.max(v1Arr.length, v2Arr.length); i++) {
      const v1Num = parseInt(v1Arr[i] || '0')
      const v2Num = parseInt(v2Arr[i] || '0')
      if (v1Num > v2Num) return 1
      if (v1Num < v2Num) return -1
    }
    return 0
  },
  gt(v1: string, v2: string): boolean {
    return this.compare(v1, v2) > 0
  },
  ge(v1: string, v2: string): boolean {
    return this.compare(v1, v2) >= 0
  },
  lt(v1: string, v2: string): boolean {
    return this.compare(v1, v2) < 0
  },
  le(v1: string, v2: string): boolean {
    return this.compare(v1, v2) <= 0
  },
  eq(v1: string, v2: string): boolean {
    return this.compare(v1, v2) === 0
  },
}
