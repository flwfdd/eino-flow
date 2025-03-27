<script setup lang="ts">
import { Position } from '@vue-flow/core'
import { Handle } from '@vue-flow/core'

interface Props {
  id?: string
  data: any
  sourcePosition?: Position
  targetPosition?: Position
}

withDefaults(defineProps<Props>(), {
  sourcePosition: () => Position.Bottom,
  targetPosition: () => Position.Top,
  connectable: true,
  isValidTargetPos: () => true,
  isValidSourcePos: () => true,
})
</script>

<template>
  <Handle type="source" :position="sourcePosition" />

  <div class="bg-background border border-current rounded-md p-2">
    <div class="text-sm">ID: {{ id }}</div>
    <div class="text-sm">Name: {{ data.name }}</div>
    <div class="text-sm">Type: {{ data.type }}</div>
    <div class="text-sm">Component: {{ data.component_schema?.name }}</div>
    <div class="text-sm">Input: {{ data.component_schema?.input_type?.title }}</div>
    <div class="text-sm">Output: {{ data.component_schema?.output_type?.title }}</div>
  </div>

  <Handle type="target" :position="targetPosition" />
</template>
