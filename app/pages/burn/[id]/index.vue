<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Burn detail</h1>
      <UButton variant="ghost" color="blue" size="sm" to="/">Home</UButton>
    </header>

    <div v-if="loading" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
      Loading…
    </div>

    <div v-else-if="!burn" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      Burn not found.
    </div>

    <template v-else>
      <section class="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <div class="flex items-baseline justify-between">
          <div>
            <span class="text-2xl font-semibold">{{ burn.kiln_id }}</span>
            <span class="ml-2 text-base text-gray-600">{{ burn.firing_type }}</span>
          </div>
          <span class="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-800">
            cone {{ burn.target_cone }}
          </span>
        </div>
      </section>

      <section class="rounded-lg border border-gray-200 bg-white p-4">
        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt class="text-xs font-medium text-gray-500">Started</dt>
            <dd class="text-sm">
              <div>{{ formatDateTime(burn.start_datetime) }}</div>
              <div v-if="burn.operators?.length" class="text-gray-600">
                by {{ burn.operators.map((o) => o.display_name).join(', ') }}
              </div>
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-gray-500">Duration</dt>
            <dd class="text-sm">{{ formatMinutes(burn.duration_minutes) }}</dd>
          </div>
          <div v-if="burn.time_to_qi != null">
            <dt class="text-xs font-medium text-gray-500">Time to QI</dt>
            <dd class="text-sm">{{ burn.time_to_qi }} min</dd>
          </div>
        </dl>
        <div v-if="burn.notes" class="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          {{ burn.notes }}
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { BurnEntry } from '~/composables/useBurns'
import type { Timestamp, Unsubscribe } from 'firebase/firestore'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { watchBurn } = useBurns()

const burn = ref<BurnEntry | null>(null)
const loading = ref(true)
let unsub: Unsubscribe | null = null

onMounted(() => {
  unsub = watchBurn(id.value, (b) => {
    burn.value = b
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
