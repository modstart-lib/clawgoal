/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string
declare const __BUILD_ID__: string
declare const __HIDE_PRO__: boolean

interface Window {
  __test: import('./utils/test').TestRegistry
  __api: {
    call(name: string, ...args: any[]): Promise<any>
    eval(name: string, handler: (...args: any[]) => void): void
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '~icons/*' {
  import type { FunctionalComponent, SVGAttributes } from 'vue'
  const component: FunctionalComponent<SVGAttributes>
  export default component
}

declare module '@wangeditor/editor-for-vue' {
  import type { DefineComponent } from 'vue'
  const Editor: DefineComponent<any, any, any>
  const Toolbar: DefineComponent<any, any, any>
  export { Editor, Toolbar }
}
