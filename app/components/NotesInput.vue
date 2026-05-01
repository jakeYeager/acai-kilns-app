<template>
  <div class="space-y-1">
    <p class="text-sm font-medium text-gray-700">{{ label }}</p>
    <UTextarea
      :model-value="modelValue"
      autoresize
      :rows="3"
      placeholder="Optional"
      @update:model-value="(v) => $emit('update:modelValue', String(v))"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string; label?: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const label = 'Notes'
</script>
