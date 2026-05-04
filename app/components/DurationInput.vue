<template>
  <div>
    <p class="text-sm font-medium text-gray-700">Duration</p>

    <!-- Idle: manual entry + start-stopwatch CTA -->
    <div v-if="!running && !frozenStartedAt" class="mt-1 space-y-2">
      <HoursMinutesInput
        :model-value="modelValue"
        @update:model-value="onManualEntry"
      />
      <UButton
        type="button"
        size="sm"
        variant="outline"
        icon="i-heroicons-play"
        @click="start"
      >Start stopwatch</UButton>
    </div>

    <!-- Running: live elapsed + Stop CTA -->
    <div
      v-else-if="running"
      class="mt-2 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 space-y-2"
    >
      <p class="text-center font-mono text-4xl font-bold text-emerald-900 tabular-nums">
        {{ liveDisplay }}
      </p>
      <p class="text-center text-xs text-emerald-700">
        Started at {{ startedAtClock }} — survives screen lock and refresh.
      </p>
      <UButton
        type="button"
        block
        size="lg"
        color="emerald"
        icon="i-heroicons-stop"
        @click="stop"
      >Stop</UButton>
    </div>

    <!-- Frozen: stopwatch finished, value populated -->
    <div v-else class="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
      <p class="text-2xl font-mono font-semibold tabular-nums">{{ formatMinutes(modelValue) || '—' }}</p>
      <p class="text-xs text-gray-600">Recorded from stopwatch — started {{ startedAtClock }}.</p>
      <UButton
        type="button"
        size="xs"
        variant="ghost"
        @click="reset"
      >Discard and re-enter</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const STORAGE_KEY = 'kilns:burn-stopwatch'

const props = defineProps<{ modelValue: number | null }>()
const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  'update:startedAt': [value: Date | null]
}>()

const startedAt = ref<Date | null>(null)
const frozenStartedAt = ref<Date | null>(null)
const running = ref(false)
const tick = ref(0)
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (!import.meta.client) return
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as { startedAt: number }
    if (typeof parsed?.startedAt !== 'number') throw new Error('bad shape')
    startedAt.value = new Date(parsed.startedAt)
    running.value = true
    beginTicking()
    emit('update:startedAt', startedAt.value)
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
  }
})

onBeforeUnmount(() => {
  if (interval) clearInterval(interval)
})

function beginTicking() {
  if (interval) clearInterval(interval)
  interval = setInterval(() => { tick.value++ }, 1000)
}

function start() {
  startedAt.value = new Date()
  frozenStartedAt.value = null
  running.value = true
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ startedAt: startedAt.value.getTime() })
  )
  beginTicking()
  emit('update:startedAt', startedAt.value)
}

function stop() {
  if (!startedAt.value) return
  running.value = false
  if (interval) { clearInterval(interval); interval = null }
  window.localStorage.removeItem(STORAGE_KEY)
  // Round to nearest minute. Operators won't care about seconds and the
  // kiln-display history was always minute-resolution.
  const minutes = Math.round((Date.now() - startedAt.value.getTime()) / 60_000)
  emit('update:modelValue', minutes)
  frozenStartedAt.value = startedAt.value
  // startedAt remains emitted so parent can lock start_datetime to the
  // moment Start was tapped.
}

function reset() {
  startedAt.value = null
  frozenStartedAt.value = null
  running.value = false
  if (interval) { clearInterval(interval); interval = null }
  window.localStorage.removeItem(STORAGE_KEY)
  emit('update:modelValue', null)
  emit('update:startedAt', null)
}

function onManualEntry(value: number | null) {
  emit('update:modelValue', value)
  // Manual entry — clear any lingering stopwatch context so the parent
  // falls back to its own start_datetime picker.
  if (frozenStartedAt.value) {
    frozenStartedAt.value = null
    emit('update:startedAt', null)
  }
}

const liveDisplay = computed(() => {
  void tick.value // re-evaluate every tick
  if (!startedAt.value) return '0:00'
  const seconds = Math.floor((Date.now() - startedAt.value.getTime()) / 1000)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
})

const startedAtClock = computed(() => {
  const ts = startedAt.value || frozenStartedAt.value
  if (!ts) return ''
  return ts.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
})
</script>
