<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Node, Edge } from '@vue-flow/core'
import { Panel, useVueFlow, VueFlow } from '@vue-flow/core'

import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'
import axios from 'axios'
import { useLayout } from './useLayout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import SimpleNode from '@/components/flow/SimpleNode.vue'
import { Input } from '@/components/ui/input'

const graphId = ref('')
const graphOptions = ref<{ id: string; name: string }[]>([])
const baseURL = ref('http://127.0.0.1:52538/eino/devops/debug/v1')

function getGraphOptions() {
  axios.get(`${baseURL.value}/graphs`).then((res) => {
    graphOptions.value = res.data.data.graphs
    graphId.value = res.data.data.graphs[0].id
  })
}
getGraphOptions()
watch(baseURL, () => {
  getGraphOptions()
})

const { layout, layoutConfig } = useLayout()
const { fitView } = useVueFlow()

// 自动布局图
async function layoutGraph() {
  try {
    const updatedNodes = await layout(nodes.value, edges.value)
    nodes.value = [...updatedNodes]

    nextTick(() => {
      fitView()
    })
  } catch (error) {
    console.error('Layout error:', error)
  }
}
watch(
  layoutConfig,
  () => {
    layoutGraph()
  },
  { deep: true },
)

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const outputMap = new Map<string, string>()
const inputMap = new Map<string, string>()

const extractNode = (node: any, parent: string): { nodes: Node[]; edges: Edge[] } => {
  const key = `${parent}/${node.key}`
  let nodes: Node[] = []
  const edges: Edge[] = []
  switch (node.type) {
    case 'start':
      if (!parent) {
        nodes.push({
          id: key,
          type: 'input',
          label: `Input`,
          position: { x: 0, y: 0 },
        })
        outputMap.set(key, key)
      }
      break
    case 'end':
      if (!parent) {
        nodes.push({
          id: key,
          type: 'output',
          label: `Output`,
          position: { x: 0, y: 0 },
        })
        inputMap.set(key, key)
      }
      break
    case 'Chain':
      nodes.push({
        id: key,
        label: `Name[${node.name}] Type[${node.type}] Component[${node.component_schema.name}]`,
        position: { x: 0, y: 0 },
        style: { background: '#aaeeff22' },
      })
      const subPrefix = key
      for (const n of node.graph_schema.nodes) {
        // 忽略子图中的 start 和 end
        if (n.type === 'start' || n.type === 'end') {
          continue
        }
        const { nodes: sub_nodes, edges: sub_edges } = extractNode(n, subPrefix)
        nodes.push(...sub_nodes)
        edges.push(...sub_edges)
      }
      for (const e of node.graph_schema.edges) {
        // 将连接到父图的边透传到子图
        if (e.source_node_key === 'start') {
          inputMap.set(key, `${subPrefix}/${e.target_node_key}`)
          continue
        }
        if (e.target_node_key === 'end') {
          outputMap.set(key, `${subPrefix}/${e.source_node_key}`)
          continue
        }
        edges.push({
          id: `${subPrefix}/${e.id}`,
          source: outputMap.get(`${subPrefix}/${e.source_node_key}`) || '',
          target: inputMap.get(`${subPrefix}/${e.target_node_key}`) || '',
          animated: true,
        })
      }
      break
    default:
      nodes.push({
        id: key,
        position: { x: 0, y: 0 },
        data: node,
        type: 'simple',
      })
      outputMap.set(key, key)
      inputMap.set(key, key)
      break
  }
  if (parent) {
    nodes = nodes.map((n) => ({
      ...n,
      parentNode: parent,
      extent: 'parent',
      data: node,
      type: 'simple',
    }))
  }
  return { nodes, edges }
}

watch(graphId, async () => {
  axios.get(`${baseURL.value}/graphs/${graphId.value}/canvas`).then(async (res) => {
    console.log(res.data.data.canvas_info)
    nodes.value = []
    edges.value = []
    outputMap.clear()
    inputMap.clear()
    const prefix = ''
    for (const node of res.data.data.canvas_info.nodes) {
      const { nodes: sub_nodes, edges: sub_edges } = extractNode(node, prefix)
      nodes.value.push(...sub_nodes)
      edges.value.push(...sub_edges)
    }
    for (const edge of res.data.data.canvas_info.edges) {
      edges.value.push({
        id: `${prefix}/${edge.id}`,
        source: outputMap.get(`${prefix}/${edge.source_node_key}`) || '',
        target: inputMap.get(`${prefix}/${edge.target_node_key}`) || '',
        animated: true,
        zIndex: 2333,
      })
    }
  })
})
</script>

<template>
  <div class="w-full h-full">
    <VueFlow :nodes="nodes" :edges="edges" @nodes-initialized="layoutGraph">
      <Background />
      <MiniMap />
      <Controls />

      <Panel position="top-left" class="bg-background">
        <Input v-model="baseURL" placeholder="API Base URL" />
        <Select v-model="graphId">
          <SelectTrigger>
            <SelectValue placeholder="Select a graph" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in graphOptions" :key="option.id" :value="option.id">
              {{ option.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" @click="layoutConfig.isHorizontal = true">Layout →</Button>
        <Button variant="outline" @click="layoutConfig.isHorizontal = false">Layout ↓</Button>
        <Button variant="outline" @click="layoutGraph">ReLayout</Button>
      </Panel>

      <template #node-simple="props">
        <SimpleNode
          :id="props.id"
          :source-position="props.sourcePosition"
          :target-position="props.targetPosition"
          :data="props.data"
        />
      </template>
    </VueFlow>
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/minimap/dist/style.css';
@import '@vue-flow/controls/dist/style.css';
</style>
