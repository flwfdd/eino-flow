import ELK from 'elkjs/lib/elk.bundled.js'
import { Position, useVueFlow, type Node, type Edge } from '@vue-flow/core'
import { ref } from 'vue'

// 使用 elkjs 进行布局
// 参考：https://eclipse.dev/elk/reference.html
// 参考：https://rtsys.informatik.uni-kiel.de/elklive/index.html

export interface LayoutConfig {
  isHorizontal: boolean
  padding: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

export const layoutConfigDefault: LayoutConfig = {
  isHorizontal: true,
  padding: {
    top: 40,
    right: 20,
    bottom: 20,
    left: 20,
  },
}

export function useLayout() {
  const { findNode } = useVueFlow()
  const elk = new ELK()
  const layoutConfig = ref<LayoutConfig>(layoutConfigDefault)

  // 将Vue Flow节点和边转换为ELK JSON格式
  function toElkGraph(nodes: Node[], edges: Edge[], LayoutConfig: LayoutConfig) {
    // 创建ELK图的根节点
    const elkGraph = {
      id: Math.random().toString(),
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': LayoutConfig.isHorizontal ? 'RIGHT' : 'DOWN',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      },
      children: [] as any[],
      edges: [] as any[],
    }

    // 记录父子关系，用于后续处理
    const childrenMap: Record<string, Node[]> = {}
    const nodeMap: Record<string, Node> = {}

    // 记录每个节点的实际宽高
    const nodeDimensions: Record<string, { width: number; height: number }> = {}

    // 第一步：组织节点到其父节点下
    for (const node of nodes) {
      const graphNode = findNode(node.id)
      const width = graphNode?.dimensions.width || 0
      const height = graphNode?.dimensions.height || 0

      nodeDimensions[node.id] = { width, height }
      nodeMap[node.id] = node

      if (node.parentNode) {
        if (!childrenMap[node.parentNode]) {
          childrenMap[node.parentNode] = []
        }
        childrenMap[node.parentNode].push(node)
      }
    }

    // 递归构建ELK图结构
    function buildElkNode(node: Node): any {
      const { width, height } = nodeDimensions[node.id]

      const elkNode: any = {
        id: node.id,
        width,
        height,
      }

      // 添加子节点
      if (childrenMap[node.id]) {
        elkNode.width = 0
        elkNode.height = 0
        elkNode.children = childrenMap[node.id].map((child) => buildElkNode(child))
        elkNode.layoutOptions = {
          'elk.padding': `[left=${layoutConfig.value.padding.left}, top=${layoutConfig.value.padding.top}, right=${layoutConfig.value.padding.right}, bottom=${layoutConfig.value.padding.bottom}]`,
        }
      }

      return elkNode
    }

    // 添加顶级节点
    for (const node of nodes) {
      if (!node.parentNode) {
        elkGraph.children.push(buildElkNode(node))
      }
    }

    // 添加边
    for (const edge of edges) {
      elkGraph.edges.push({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })
    }

    return { elkGraph, LayoutConfig, nodeMap, nodeDimensions }
  }

  // 将ELK计算结果应用到Vue Flow节点
  function applyLayout(
    elkGraph: any,
    nodes: Node[],
    LayoutConfig: LayoutConfig,
    nodeMap: Record<string, Node>,
  ): Node[] {
    // 递归处理所有节点及其子节点的位置
    function processNode(elkNode: any) {
      if (!elkNode) return

      // 更新当前节点
      const node = nodeMap[elkNode.id]
      node.position = { x: elkNode.x, y: elkNode.y }
      node.targetPosition = LayoutConfig.isHorizontal ? Position.Left : Position.Top
      node.sourcePosition = LayoutConfig.isHorizontal ? Position.Right : Position.Bottom

      // 递归处理子节点
      if (elkNode.children) {
        for (const child of elkNode.children) {
          processNode(child)
          elkNode.width = Math.max(
            elkNode.width,
            child.x + child.width + layoutConfig.value.padding.right,
          )
          elkNode.height = Math.max(
            elkNode.height,
            child.y + child.height + layoutConfig.value.padding.bottom,
          )
        }
        if (node.style) {
          node.style = {
            ...node.style,
            width: `${elkNode.width}px`,
            height: `${elkNode.height}px`,
          }
        }
      }
    }

    // 处理根节点的所有子节点
    if (elkGraph.children) {
      for (const child of elkGraph.children) {
        processNode(child)
      }
    }

    return [...nodes]
  }

  async function layout(nodes: Node[], edges: Edge[]): Promise<Node[]> {
    if (nodes.length === 0) return nodes

    try {
      // 转换为ELK图格式
      const { elkGraph, nodeMap } = toElkGraph(nodes, edges, layoutConfig.value)

      // 应用ELK布局
      const layoutedGraph = await elk.layout(elkGraph)

      // 将布局结果应用到Vue Flow节点
      return applyLayout(layoutedGraph, nodes, layoutConfig.value, nodeMap)
    } catch (error) {
      console.error('ELK layout error:', error)
      return nodes
    }
  }

  return { layout, layoutConfig }
}
