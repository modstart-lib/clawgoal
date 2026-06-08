import type { App } from 'vue'
import { createApp, defineComponent, h, ref } from 'vue'
import Antd from 'ant-design-vue'
import { HtmlNode } from '@logicflow/core'
import { vueNodesMap } from './registry'
import i18n from '../../../../locale'
import { pinia } from '../../../../stores/pinia'

type NodeAppEntry = {
  app: App
  propsRef: ReturnType<typeof ref>
  wrapper: HTMLElement
  ro: ResizeObserver
}

// 以 graphModel 为 key 隔离不同编辑器实例的节点 Vue App，
// 避免 WorkflowEdit 与 WorkflowLogViewDialog 同时打开时 nodeId 冲突
const editorNodeMaps = new WeakMap<any, Map<string, NodeAppEntry>>()

function getNodeApps(graphModel: any): Map<string, NodeAppEntry> {
  if (!editorNodeMaps.has(graphModel)) {
    editorNodeMaps.set(graphModel, new Map())
  }
  return editorNodeMaps.get(graphModel)!
}

function refreshNodeEdges(model: any) {
  model.graphModel.edges.forEach((edge: any) => {
    if (edge.sourceNodeId === model.id || edge.targetNodeId === model.id) {
      edge.initPoints?.()
    }
  })
}

function syncModelHeight(wrapper: HTMLElement, model: any) {
  const h = wrapper.scrollHeight
  if (h > 10 && Math.round(h) !== model.height) {
    model.height = Math.round(h)
    refreshNodeEdges(model)
  }
}

export class VueNodeView extends HtmlNode {
  shouldUpdate() {
    return true
  }

  setHtml(rootEl: SVGForeignObjectElement) {
    const { model } = this.props as any
    const nodeId = model.id
    const config = vueNodesMap[model.type]
    if (!config) return

    const properties = model.getProperties()
    const nodeApps = getNodeApps(model.graphModel)

    if (nodeApps.has(nodeId)) {
      const entry = nodeApps.get(nodeId)!
      const prevOutputs = JSON.stringify((entry.propsRef.value as any)?.outputs)
      const nextOutputs = JSON.stringify(properties?.outputs)
      entry.propsRef.value = properties
      entry.wrapper.dataset.nodeStatus = properties.status || ''
      setTimeout(() => {
        syncModelHeight(entry.wrapper, model)
        if (prevOutputs !== nextOutputs) refreshNodeEdges(model)
      }, 80)
      return
    }

    rootEl.innerHTML = ''
    const wrapper = document.createElement('div')
    wrapper.style.cssText = 'width:100%;'
    wrapper.dataset.nodeStatus = properties.status || ''
    rootEl.appendChild(wrapper)

    const propsRef = ref(properties)

    const app = createApp(
      defineComponent({
        name: 'LfNodeWrapper',
        setup() {
          return () =>
            h(config.component, {
              node: model,
              properties: propsRef.value,
              'onUpdate:properties': (val: any) => {
                model.setProperties({ ...model.getProperties(), ...val })
              },
            })
        },
      })
    )
    app.use(Antd)
    app.use(i18n)
    app.use(pinia)
    app.mount(wrapper)

    const ro = new ResizeObserver(() => syncModelHeight(wrapper, model))
    ro.observe(wrapper)
    nodeApps.set(nodeId, { app, propsRef, wrapper, ro })
  }
}

export default VueNodeView
