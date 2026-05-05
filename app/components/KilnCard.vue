<template>
  <article class="rounded-lg border bg-white p-4 transition" :class="borderClass">
    <header class="flex items-baseline justify-between gap-2">
      <h3 class="text-lg font-semibold">{{ kiln.display_name }}</h3>
      <UIcon
        name="i-heroicons-bolt-solid"
        :class="isFiring ? 'text-orange-500' : 'text-gray-400'"
        :aria-label="statusLabel"
        class="h-6 w-6"
      />
    </header>

    <div v-if="firing" class="mt-2 space-y-1 text-sm text-gray-700">
      <p v-if="firing.program_label">
        <span class="text-gray-500">Program:</span>
        {{ firing.program_label }}
      </p>
      <p>
        <span class="text-gray-500">Started:</span>
        {{ elapsed }} ago
      </p>
      <p v-if="loaderNames.length">
        <span class="text-gray-500">Loaded by:</span>
        {{ loaderNames.join(', ') }}
      </p>
      <p v-if="firing.candle_hrs != null" class="text-xs text-gray-500">
        Candle: {{ firing.candle_hrs }} hr
      </p>
    </div>
    <p v-else class="mt-2 text-sm text-gray-500">No firing in progress.</p>

    <div v-if="showActions" class="mt-3 flex flex-wrap gap-2">
      <UButton
        v-if="canStart"
        size="sm"
        icon="i-heroicons-play"
        :to="`/firing/new?kiln=${kiln.id}`"
      >Start firing</UButton>
      <UButton
        v-if="canClose"
        size="sm"
        color="purple"
        variant="outline"
        icon="i-heroicons-stop"
        :to="`/firing/${firing!.id}/close`"
      >Close firing</UButton>
      <UButton
        v-if="canReport"
        size="sm"
        variant="outline"
        icon="i-heroicons-bell-alert"
        :to="`/problem/new?kiln=${kiln.id}&severity=blocking`"
      >Report error code</UButton>
      <UButton
        v-if="canReport"
        size="sm"
        variant="outline"
        icon="i-heroicons-bell-alert"
        :to="`/problem/new?kiln=${kiln.id}&severity=non_blocking`"
      >Report problem</UButton>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { KilnDoc } from '~/composables/useLookups'
import type { FiringEntry } from '~/composables/useFirings'
import type { Timestamp } from 'firebase/firestore'

const props = defineProps<{ kiln: KilnDoc; firing: FiringEntry | null }>()

const { state, isOnRoster } = useCurrentMember()

const isFiring = computed(() => Boolean(props.firing))
const statusLabel = computed(() => (isFiring.value ? 'Firing' : 'Idle'))
const borderClass = computed(() =>
  isFiring.value ? 'border-emerald-500' : 'border-gray-200'
)

const isLoader = computed(
  () => state.value.member?.training?.electric?.loader === true
)
const isUnloader = computed(
  () => state.value.member?.training?.electric?.unloader === true
)

const canStart = computed(() => isOnRoster.value && isLoader.value && !isFiring.value)
const canClose = computed(() => isOnRoster.value && isUnloader.value && isFiring.value)
const canReport = computed(() => isOnRoster.value)
const showActions = computed(
  () => canStart.value || canClose.value || canReport.value
)

const loaderNames = computed(
  () => (props.firing?.loaders || []).map((l) => l.display_name)
)

const now = ref(new Date())
let interval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  interval = setInterval(() => { now.value = new Date() }, 60_000)
})
onBeforeUnmount(() => {
  if (interval) clearInterval(interval)
})

const elapsed = computed(() => {
  const ts = props.firing?.start_datetime as Timestamp | undefined
  if (!ts?.toDate) return ''
  const minutes = Math.max(0, Math.round((now.value.getTime() - ts.toDate().getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
})
</script>
