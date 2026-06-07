/** @type {import('tailwindcss').Config} */
export default {
  // content 与 darkMode 已迁移到 src/assets/main.css（@source / @variant dark）
  // colors 已迁移到 src/theme/tokens.css（@theme inline）
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  // 使用 CSS 选择器提升特异性，生成 #app-root .class 形式的选择器
  // 这样特异性高于 Ant Design 的动态样式（通常只有单个类名）
  important: '#app-root',
  // 禁用 @layer，直接生成扁平样式
  corePlugins: {
    preflight: false,
  },
  plugins: [],
}
