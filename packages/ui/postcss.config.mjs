import tailwindcss from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

// 插件：确保 Shadow DOM 中变量生效
// 将 :root 选择器转换为 :root, :host
const addHostToRootPlugin = () => {
  return {
    postcssPlugin: 'add-host-to-root',
    Rule(rule) {
      if (rule.selector === ':root') {
        rule.selector = ':root, :host'
      }
    }
  }
}
addHostToRootPlugin.postcss = true

// 插件：移除 @layer 包裹
const removeLayerPlugin = () => {
  return {
    postcssPlugin: 'remove-layer',
    AtRule: {
      layer(atRule) {
        // 将 @layer 内的规则提升到外层
        const parent = atRule.parent
        const nodes = atRule.nodes
        if (nodes) {
          nodes.forEach(node => {
            parent.insertBefore(atRule, node)
          })
        }
        atRule.remove()
      }
    }
  }
}
removeLayerPlugin.postcss = true

// 插件：移除不兼容的 @supports 包裹
// 将包含 -webkit-hyphens:none 和 margin-trim:inline 的 @supports 内的规则提升到外层
const removeUnsupportedSupportsPlugin = () => {
  return {
    postcssPlugin: 'remove-unsupported-supports',
    AtRule: {
      supports(atRule) {
        const params = atRule.params
        // 精准匹配：包含 -webkit-hyphens:none 和 margin-trim:inline 的 @supports 规则
        if (params.includes('-webkit-hyphens:none') && params.includes('margin-trim:inline')) {
          // 将 @supports 内的规则提升到外层
          const parent = atRule.parent
          const nodes = atRule.nodes
          if (nodes) {
            nodes.forEach(node => {
              parent.insertBefore(atRule, node)
            })
          }
          atRule.remove()
        }
      }
    }
  }
}
removeUnsupportedSupportsPlugin.postcss = true

export default {
  plugins: [
    tailwindcss,
    addHostToRootPlugin,
    removeLayerPlugin,
    removeUnsupportedSupportsPlugin,
    autoprefixer,
  ],
}
