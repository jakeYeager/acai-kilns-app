<template>
  <div>
    <p class="text-sm font-medium text-gray-700">Target cone</p>
    <p class="text-xs text-gray-500">Text — preserves leading zeros (e.g. "06", "010").</p>
    <UInput
      :model-value="modelValue"
      placeholder="e.g. 06"
      inputmode="text"
      autocomplete="off"
      size="lg"
      class="mt-1"
      required
      @update:model-value="$emit('update:modelValue', String($event))"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
