import 'vue'

declare module 'vue' {
  interface ComponentCustomProperties {
    __HIDE_PRO__: boolean
  }
}
