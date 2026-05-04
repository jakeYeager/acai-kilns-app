<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-gray-700">Firing type</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="t in rakuFiringTypes"
        :key="t.id"
        type="button"
        class="rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors"
        :class="modelValue === t.id
          ? 'border-primary-500 bg-primary-50 text-primary-900'
          : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'"
        @click="$emit('update:modelValue', t.id)"
      >
        {{ t.label }}
      </button>
    </div>
    <p v-if="!rakuFiringTypes.length" class="text-sm text-gray-500">
      No active firing types. Admin can add via Firestore (or /admin in phase 10).
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string | null }>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const { rakuFiringTypes } = useLookups()
</script>
