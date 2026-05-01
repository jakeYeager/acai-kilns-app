<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Firing detail</h1>
      <UButton variant="ghost" size="sm" to="/">Home</UButton>
    </header>

    <div v-if="loading" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
      Loading…
    </div>

    <div v-else-if="!firing" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      Firing not found.
    </div>

    <template v-else>
      <section class="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <div class="flex items-baseline justify-between">
          <div>
            <span class="text-2xl font-semibold">{{ firing.kiln_id }}</span>
            <span v-if="firing.program_label" class="ml-2 text-base text-gray-600">{{ firing.program_label }}</span>
          </div>
          <span
            class="rounded-full px-3 py-1 text-xs font-medium"
            :class="firing.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'"
          >
            {{ firing.status }}
          </span>
        </div>
      </section>

      <section class="rounded-lg border border-gray-200 bg-white p-4">
        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt class="text-xs font-medium text-gray-500">Loaded</dt>
            <dd class="text-sm">
              <div>{{ formatDateTime(firing.start_datetime) }}</div>
              <div v-if="firing.loaders?.length" class="text-gray-600">
                by {{ firing.loaders.map((l) => l.display_name).join(', ') }}
              </div>
            </dd>
          </div>
          <div v-if="firing.candle_hrs != null">
            <dt class="text-xs font-medium text-gray-500">Candle</dt>
            <dd class="text-sm">{{ firing.candle_hrs }} hr</dd>
          </div>
          <div v-if="firing.unload_datetime">
            <dt class="text-xs font-medium text-gray-500">Unloaded</dt>
            <dd class="text-sm">
              <div>{{ formatDateTime(firing.unload_datetime) }}</div>
              <div v-if="firing.unloaders?.length" class="text-gray-600">
                by {{ firing.unloaders.map((u) => u.display_name).join(', ') }}
              </div>
            </dd>
          </div>
          <div v-if="firing.firing_hh_mm">
            <dt class="text-xs font-medium text-gray-500">Duration</dt>
            <dd class="text-sm">{{ firing.firing_hh_mm }}</dd>
          </div>
          <div v-if="firing.unload_temp != null">
            <dt class="text-xs font-medium text-gray-500">Unload temp</dt>
            <dd class="text-sm">{{ firing.unload_temp }}°F</dd>
          </div>
        </dl>
        <div v-if="firing.notes" class="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          {{ firing.notes }}
        </div>
      </section>

      <UButton
        v-if="firing.status === 'open'"
        :to="`/firing/${id}/close`"
        block
        size="lg"
      >
        Close this firing
      </UButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { FiringEntry } from '~/composables/useFirings'
import type { Timestamp, Unsubscribe } from 'firebase/firestore'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { watchFiring } = useFirings()

const firing = ref<FiringEntry | null>(null)
const loading = ref(true)
let unsub: Unsubscribe | null = null

onMounted(() => {
  unsub = watchFiring(id.value, (f) => {
    firing.value = f
    loading.value = false
  })
})
onBeforeUnmount(() => { if (unsub) unsub() })

function formatDateTime(ts: Timestamp): string {
  return ts.toDate().toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
</script>
