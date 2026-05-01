<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-gray-700">{{ label }}</p>
    <UInput
      v-model="local"
      type="datetime-local"
      size="lg"
      :step="60"
      @change="emitValue"
    />
    <div class="flex flex-wrap gap-2">
      <button
        v-for="s in shortcuts"
        :key="s.label"
        type="button"
        class="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:border-gray-300"
        @click="setRelative(s.minutesAgo)"
      >
        {{ s.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: Date | null
  label?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Date] }>()

const label = computed(() => props.label || 'When')

const shortcuts = [
  { label: 'Now', minutesAgo: 0 },
  { label: '5 min ago', minutesAgo: 5 },
  { label: '15 min ago', minutesAgo: 15 },
  { label: '1 hr ago', minutesAgo: 60 },
]

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const local = ref(toLocalInput(props.modelValue ?? new Date()))

watch(() => props.modelValue, (v) => {
  if (v) local.value = toLocalInput(v)
})

function emitValue() {
  if (!local.value) return
  // datetime-local strings are interpreted as local time when passed to Date
  emit('update:modelValue', new Date(local.value))
}

function setRelative(minutesAgo: number) {
  const d = new Date(Date.now() - minutesAgo * 60_000)
  local.value = toLocalInput(d)
  emit('update:modelValue', d)
}

// Emit initial value to parent if not already set
onMounted(() => {
  if (!props.modelValue) emitValue()
})
</script>
