/**
 * Get the maximum z-index among all elements on the page
 * @returns {number} Maximum z-index value
 */
export function getMaxZIndex(): number {
  const elements = document.querySelectorAll('*')
  let maxZIndex = 0

  elements.forEach((element) => {
    const zIndex = window.getComputedStyle(element).zIndex
    if (zIndex !== 'auto' && !isNaN(Number(zIndex))) {
      const zIndexNum = parseInt(zIndex, 10)
      if (zIndexNum > maxZIndex) {
        maxZIndex = zIndexNum
      }
    }
  })

  return maxZIndex
}

/**
 * Get the base z-index that Ant Design components should use
 * @param {number} offset - Offset added on top of the maximum z-index, default 100
 * @returns {number} Recommended z-index base value
 */
export function getAntdZIndexBase(offset = 100): number {
  const maxZIndex = getMaxZIndex()
  return Math.max(1000, maxZIndex + offset)
}
