/**
 * Ant Design Vue popup z-index dynamic management utility
 *
 * Provides multiple ways to ensure AntD popups always appear on top
 */

import { getAntdZIndexBase } from './zindex'

interface ComponentConfig {
  zIndex?: number
  overlayStyle?: Record<string, any>
  [key: string]: any
}

/**
 * Dynamically set z-index for Modal component
 * @param {Object} options - Modal configuration object
 * @returns {Object} Configuration object containing dynamic z-index
 */
export function getModalConfig(options: ComponentConfig = {}): ComponentConfig {
  const zIndex = getAntdZIndexBase(100)

  return {
    zIndex,
    ...options,
  }
}

/**
 * Dynamically set z-index for Drawer component
 * @param {Object} options - Drawer configuration object
 * @returns {Object} Configuration object containing dynamic z-index
 */
export function getDrawerConfig(
  options: ComponentConfig = {}
): ComponentConfig {
  const zIndex = getAntdZIndexBase(100)

  return {
    zIndex,
    ...options,
  }
}

/**
 * Dynamically set overlayStyle for Dropdown/Popover/Tooltip and similar components
 * @param {Object} options - Component configuration object
 * @returns {Object} Configuration object containing dynamic z-index
 */
export function getPopupConfig(options: ComponentConfig = {}): ComponentConfig {
  const zIndex = getAntdZIndexBase(50)

  return {
    overlayStyle: {
      zIndex,
      ...(options.overlayStyle || {}),
    },
    ...options,
  }
}

/**
 * Configuration for functional Modal invocation
 * Example: Modal.confirm(getModalFunctionConfig({ title: 'Confirm' }))
 */
export function getModalFunctionConfig(
  config: ComponentConfig = {}
): ComponentConfig {
  return getModalConfig(config)
}
