<template>
  <article class="rounded-lg border border-gray-200 bg-white p-4 transition">
    <header class="flex items-baseline justify-between gap-2">
      <h3 class="text-lg font-semibold">{{ kiln.display_name }}</h3>
      <span class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
        Gas / Raku
      </span>
    </header>

    <div class="mt-2 space-y-1 text-sm text-gray-700">
      <p v-if="lastBurn">
        <span class="text-gray-500">Last burn:</span>
        {{ lastBurnAgo }}
        <span class="text-gray-500">·</span>
        {{ lastBurn.firing_type }} cone {{ lastBurn.target_cone }}
      </p>
      <p v-else class="text-gray-500">No burns logged yet.</p>

      <p v-if="latestRefill">
        <span class="text-gray-500">Tank refilled:</span>
        {{ refilledAgo }}
        <span class="text-gray-500">·</span>
        {{ latestRefill.gallons }} gal
      </p>
      <p v-if="latestRefill && burnsSinceRefill != null" class="text-xs text-gray-500">
        {{ burnsSinceRefill }} burns since refill<span v-if="costPerBurn"> · ${{ costPerBurn.toFixed(2) }}/burn</span>
      </p>
      <p v-if="!latestRefill" class="text-xs text-gray-500">No refills logged yet.</p>
    </div>

    <div v-if="showActions" class="mt-3 flex flex-wrap gap-2">
      <UButton
        v-if="canLogBurn"
        size="sm"
        :to="`/burn/new?kiln=${kiln.id}`"
      >Log a burn</UButton>
      <UButton
        v-if="canLogRefill"
        size="sm"
        variant="outline"
        :to="`/refill/new?kiln=${kiln.id}`"
      >Log refill</UButton>
      <UButton
        v-if="canReport"
        size="sm"
        variant="outline"
        :to="`/problem/new?kiln=${kiln.id}&type=general`"
      >Report problem</UButton>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { KilnDoc } from '~/composables/useLookups'
import type { BurnEntry } from '~/composables/useBurns'
import type { RefillEntry } from '~/composables/useRefills'

const props = defineProps<{
  kiln: KilnDoc
  lastBurn: BurnEntry | null
  latestRefill: RefillEntry | null
}>()

const { state, isOnRoster } = useCurrentMember()

const isOperator = computed(
  () => state.value.member?.training?.gas_propane?.operator === true
)

const canLogBurn = computed(() => isOnRoster.value && isOperator.value)
const canLogRefill = computed(() => isOnRoster.value)
const canReport = computed(() => isOnRoster.value)
const showActions = computed(
  () => canLogBurn.value || canLogRefill.value || canReport.value
)

const now = ref(new Date())
let interval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  interval = setInterval(() => { now.value = new Date() }, 60_000)
})
onBeforeUnmount(() => { if (interval) clearInterval(interval) })

function ago(date: Date): string {
  const minutes = Math.max(0, Math.round((now.value.getTime() - date.getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

const lastBurnAgo = computed(() => {
  const ts = props.lastBurn?.start_datetime
  return ts?.toDate ? ago(ts.toDate()) : ''
})
const refilledAgo = computed(() => {
  const ts = props.latestRefill?.refilled_at
  return ts?.toDate ? ago(ts.toDate()) : ''
})

const burnsSinceRefill = computed(() => props.latestRefill?.burns_since_last)
const costPerBurn = computed(() => {
  const r = props.latestRefill
  if (!r || r.cost == null || r.burns_since_last <= 0) return null
  return r.cost / r.burns_since_last
})
</script>
