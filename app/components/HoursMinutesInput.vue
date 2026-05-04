<template>
  <div class="flex items-end gap-3">
    <div class="flex-1">
      <p class="text-xs text-gray-500">Hours</p>
      <UInput
        :model-value="hoursRaw"
        type="number"
        inputmode="numeric"
        min="0"
        placeholder="0"
        size="lg"
        class="mt-1"
        @update:model-value="onHoursInput(String($event))"
      />
    </div>
    <div class="flex-1">
      <p class="text-xs text-gray-500">Minutes</p>
      <UInput
        :model-value="minutesRaw"
        type="number"
        inputmode="numeric"
        min="0"
        placeholder="0"
        size="lg"
        class="mt-1"
        @update:model-value="onMinutesInput(String($event))"
        @blur="onBlur"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: number | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const hoursRaw = ref('')
const minutesRaw = ref('')

// Sync local raw state from external modelValue (e.g. stopwatch stop()).
// Skip when both inputs are blank to avoid overwriting active typing.
watch(
  () => props.modelValue,
  (val) => {
    if (val == null) {
      hoursRaw.value = ''
      minutesRaw.value = ''
      return
    }
    const h = Math.floor(val / 60)
    const m = val % 60
    hoursRaw.value = h ? String(h) : ''
    minutesRaw.value = String(m)
  },
  { immediate: true }
)

function emitTotal() {
  const h = parseInt(hoursRaw.value, 10)
  const m = parseInt(minutesRaw.value, 10)
  const hours = Number.isFinite(h) ? h : 0
  const minutes = Number.isFinite(m) ? m : 0
  if (!hoursRaw.value && !minutesRaw.value) {
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', hours * 60 + minutes)
}

function onHoursInput(v: string) {
  hoursRaw.value = v.replace(/[^\d]/g, '')
  emitTotal()
}

function onMinutesInput(v: string) {
  minutesRaw.value = v.replace(/[^\d]/g, '')
  emitTotal()
}

// Cultural rollover: 90 minutes → 1h 30m on blur. Operators think in
// rounded hours but timers count in minutes — let the form do the math.
function onBlur() {
  const m = parseInt(minutesRaw.value, 10)
  if (!Number.isFinite(m) || m < 60) return
  const h = parseInt(hoursRaw.value, 10) || 0
  const total = h * 60 + m
  hoursRaw.value = String(Math.floor(total / 60))
  minutesRaw.value = String(total % 60)
  emitTotal()
}
</script>
