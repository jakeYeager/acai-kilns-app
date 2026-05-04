<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-gray-700">{{ label }}</p>
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="k in kilns"
        :key="k.id"
        type="button"
        class="rounded-lg border-2 px-4 py-6 text-lg font-semibold transition-colors"
        :class="modelValue === k.id
          ? 'border-primary-500 bg-primary-50 text-primary-900'
          : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'"
        @click="$emit('update:modelValue', k.id)"
      >
        {{ k.display_name }}
      </button>
    </div>
    <p v-if="!kilns.length && !loading" class="text-sm text-gray-500">
      No active {{ type === 'electric' ? 'electric' : 'gas' }} kilns. Ask an admin to add one.
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string | null
  type: 'electric' | 'gas_propane'
  label?: string
}>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const { electricKilns, gasPropaneKilns, state } = useLookups()
const loading = computed(() => state.value.loading)
const kilns = computed(() => (props.type === 'electric' ? electricKilns.value : gasPropaneKilns.value))
const label = computed(() => props.label || 'Pick a kiln')
</script>
