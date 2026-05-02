<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Refill detail</h1>
      <UButton variant="ghost" size="sm" to="/">Home</UButton>
    </header>

    <div v-if="loading" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
      Loading…
    </div>

    <div v-else-if="!refill" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      Refill not found.
    </div>

    <template v-else>
      <section class="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <div class="flex items-baseline justify-between">
          <span class="text-2xl font-semibold">{{ refill.kiln_id }}</span>
          <span class="text-sm text-gray-500">{{ formatDateTime(refill.refilled_at) }}</span>
        </div>
      </section>

      <section class="rounded-lg border border-gray-200 bg-white p-4">
        <dl class="grid grid-cols-2 gap-3">
          <div>
            <dt class="text-xs font-medium text-gray-500">Gallons</dt>
            <dd class="text-lg">{{ refill.gallons }}</dd>
          </div>
          <div v-if="refill.cost != null">
            <dt class="text-xs font-medium text-gray-500">Cost</dt>
            <dd class="text-lg">${{ refill.cost.toFixed(2) }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-gray-500">Burns since last</dt>
            <dd class="text-lg">{{ refill.burns_since_last }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-gray-500">Burn minutes since last</dt>
            <dd class="text-lg">{{ refill.total_minutes_since_last }}</dd>
          </div>
          <div v-if="costPerBurn != null">
            <dt class="text-xs font-medium text-gray-500">$/burn (this fill)</dt>
            <dd class="text-lg">${{ costPerBurn.toFixed(2) }}</dd>
          </div>
        </dl>
        <div v-if="refill.notes" class="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          {{ refill.notes }}
        </div>
      </section>

      <!-- Admin override of counters (manual fix when a missed burn is added later) -->
      <section
        v-if="isAdmin"
        class="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3"
      >
        <h2 class="text-sm font-medium text-amber-900">Admin: override counters</h2>
        <p class="text-xs text-amber-800">
          Use when a late-discovered burn shifts the window. Phase 7 will auto-recompute these on burn edits.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <UInput v-model="overrideBurnsRaw" type="number" min="0" placeholder="Burns" size="sm" />
          <UInput v-model="overrideMinutesRaw" type="number" min="0" placeholder="Minutes" size="sm" />
        </div>
        <UButton size="sm" color="amber" :loading="saving" :disabled="!overrideValid" @click="onOverride">
          Save override
        </UButton>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { RefillEntry } from '~/composables/useRefills'
import type { Timestamp, Unsubscribe } from 'firebase/firestore'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { isAdmin } = useCurrentMember()
const { watchRefill, overrideCounters } = useRefills()

const refill = ref<RefillEntry | null>(null)
const loading = ref(true)
let unsub: Unsubscribe | null = null

const overrideBurnsRaw = ref('')
const overrideMinutesRaw = ref('')
const saving = ref(false)

onMounted(() => {
  unsub = watchRefill(id.value, (r) => {
    refill.value = r
    loading.value = false
    if (r) {
      overrideBurnsRaw.value = String(r.burns_since_last)
      overrideMinutesRaw.value = String(r.total_minutes_since_last)
    }
  })
})
onBeforeUnmount(() => { if (unsub) unsub() })

const costPerBurn = computed(() => {
  if (!refill.value) return null
  if (refill.value.cost == null) return null
  if (refill.value.burns_since_last <= 0) return null
  return refill.value.cost / refill.value.burns_since_last
})

const overrideValid = computed(() => {
  const b = parseInt(overrideBurnsRaw.value, 10)
  const m = parseInt(overrideMinutesRaw.value, 10)
  return !Number.isNaN(b) && !Number.isNaN(m) && b >= 0 && m >= 0
})

async function onOverride() {
  if (!overrideValid.value || !refill.value) return
  saving.value = true
  try {
    await overrideCounters(refill.value.id, {
      burns_since_last: parseInt(overrideBurnsRaw.value, 10),
      total_minutes_since_last: parseInt(overrideMinutesRaw.value, 10),
    })
  } catch (err) {
    console.error('[refill/override] failed', err)
  } finally {
    saving.value = false
  }
}

function formatDateTime(ts: Timestamp): string {
  return ts.toDate().toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
</script>
