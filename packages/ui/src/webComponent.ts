import Antd, { message as antdMessage } from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { createPinia } from 'pinia'
import { createApp, type App } from 'vue'
import AppComponent from './App.vue'
import { setApiBase } from './api/client'
import './assets/main.css'
import i18n from './locale'
import router from './router'

class ClawGoalApp extends HTMLElement {
  app: App | null = null
  mountPoint: HTMLDivElement | null = null
  styleContainer: HTMLDivElement | null = null

  constructor() {
    super()
  }

  async connectedCallback(): Promise<void> {
    if (this.app || this.shadowRoot) {
      return
    }

    const shadow = this.attachShadow({ mode: 'open' })

    this.setupApiBase()

    this.styleContainer = document.createElement('div')
    this.styleContainer.id = 'ant-design-style-container'
    shadow.appendChild(this.styleContainer)

    await this.loadStyles(shadow)

    const styleElement = document.createElement('style')
    styleElement.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        color: inherit;
        --default-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
      }
      #clawgoal-app {
        width: 100%;
        height: 100%;
        font-family: var(--default-font-family);
        font-size: 14px;
        line-height: 1.5715;
        color: rgba(0, 0, 0, 0.85);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    `
    shadow.appendChild(styleElement)

    this.mountPoint = document.createElement('div')
    this.mountPoint.id = 'clawgoal-app'
    shadow.appendChild(this.mountPoint)

    this.app = createApp(AppComponent)
    const pinia = createPinia()

    this.app.use(pinia)
    this.app.use(Antd)
    this.app.use(router)
    this.app.use(i18n)

    this.app.provide('antdLocale', zhCN)
    this.app.provide('styleContainer', this.styleContainer)

    const shadowRoot = shadow
    const messageConfig = {
      getContainer: () => this.mountPoint || shadowRoot,
      top: '24px',
    }

    this.app.config.globalProperties.$message = {
      ...antdMessage,
      success: (content: string, duration?: number, onClose?: () => void) => {
        antdMessage.success({
          content,
          duration,
          onClose,
          ...messageConfig,
        })
      },
      error: (content: string, duration?: number, onClose?: () => void) => {
        antdMessage.error({
          content,
          duration,
          onClose,
          ...messageConfig,
        })
      },
      info: (content: string, duration?: number, onClose?: () => void) => {
        antdMessage.info({
          content,
          duration,
          onClose,
          ...messageConfig,
        })
      },
      warning: (content: string, duration?: number, onClose?: () => void) => {
        antdMessage.warning({
          content,
          duration,
          onClose,
          ...messageConfig,
        })
      },
      warn: (content: string, duration?: number, onClose?: () => void) => {
        antdMessage.warning({
          content,
          duration,
          onClose,
          ...messageConfig,
        })
      },
      loading: (content: string, duration?: number, onClose?: () => void) => {
        antdMessage.loading({
          content,
          duration,
          onClose,
          ...messageConfig,
        })
      },
    }

    this.app.mount(this.mountPoint)
  }

  async loadStyles(shadow: ShadowRoot): Promise<void> {
    const loadCssFile = async (url: string): Promise<boolean> => {
      try {
        const response = await fetch(url)
        if (response.ok) {
          const cssText = await response.text()
          const style = document.createElement('style')
          style.textContent = cssText
          shadow.appendChild(style)
          return true
        }
      } catch (e) {
        console.warn(`Failed to load CSS: ${url}`, e)
      }
      return false
    }

    const cssUrl = this.getAttribute('css-url')
    if (cssUrl) {
      const loaded = await loadCssFile(cssUrl)
      if (loaded) {
        console.log('ClawGoal: CSS loaded from css-url attribute')
        return
      }
    }

    const scriptUrl = import.meta.url
    const baseUrl = scriptUrl.substring(0, scriptUrl.lastIndexOf('/'))

    const defaultCssUrl = `${baseUrl}/../awesomeme.css`
    const loaded = await loadCssFile(defaultCssUrl)

    if (loaded) {
      console.log('ClawGoal: CSS loaded from default location')
    } else {
      console.warn(
        'ClawGoal: Failed to load CSS file. Please specify css-url attribute.'
      )
    }
  }

  setupApiBase(): void {
    const apiBaseAttr = this.getAttribute('api-base')
    const normalizedApiBaseAttr = apiBaseAttr?.trim()
    const apiBase =
      normalizedApiBaseAttr && normalizedApiBaseAttr !== '/api'
        ? normalizedApiBaseAttr
        : '/clawgoal-api/api'
    setApiBase(apiBase)
    console.log(`ClawGoal: API base set to ${apiBase}`)
  }

  disconnectedCallback(): void {
    if (this.app) {
      this.app.unmount()
      this.app = null
    }
  }

  navigateTo(path: string): void {
    if (router) {
      router.push(path)
    }
  }

  getCurrentRoute() {
    return router?.currentRoute.value
  }
}

function defineClawGoalAppElement(): void {
  if (!customElements.get('clawgoal-app')) {
    customElements.define('clawgoal-app', ClawGoalApp)
  }
}

defineClawGoalAppElement()

const currentScript = document.currentScript
if (currentScript && currentScript.hasAttribute('data-auto-register')) {
  console.log('ClawGoal Web Component auto-registered')
}

export function initClawGoal(
  selector: string | HTMLElement
): HTMLElement | null {
  const container =
    typeof selector === 'string' ? document.querySelector(selector) : selector

  if (!container) {
    console.error('ClawGoal: Container not found')
    return null
  }

  const element = document.createElement('clawgoal-app')
  if (!element.getAttribute('api-base')) {
    element.setAttribute('api-base', '/clawgoal-api/api')
  }
  container.appendChild(element)
  return element
}

export { ClawGoalApp }

export default {
  ClawGoalApp,
  initClawGoal,
  install() {
    defineClawGoalAppElement()
  },
}
