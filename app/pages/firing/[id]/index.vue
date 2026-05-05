<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Firing detail</h1>
      <UButton variant="ghost" color="blue" size="sm" to="/">Home</UButton>
    </header>

    <div v-if="loading" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
      Loading…
    </div>

    <div v-else-if="!firing" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      Firing not found.
    </div>

    <template v-else>
      <section class="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span class="text-2xl font-semibold">{{ firing.kiln_id }}</span>
            <span v-if="firing.program_label" class="ml-2 text-base text-gray-600">{{ firing.program_label }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="firing.has_problem"
              class="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800"
            >
              <UIcon name="i-heroicons-bell-alert" class="h-3.5 w-3.5" />
              Problem reported
            </span>
            <span
              class="rounded-full px-3 py-1 text-xs font-medium"
              :class="firing.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'"
            >
              {{ firing.status }}
            </span>
          </div>
        </div>
      </section>

      <section v-if="problems.length" class="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
        <h2 class="text-sm font-semibold text-red-900">Problems on this firing</h2>
        <ul class="space-y-2 text-sm">
          <li v-for="p in problems" :key="p.id" class="rounded-md bg-white/80 p-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <span class="font-medium">
                {{ p.severity === 'blocking' ? 'Blocking' : 'Observation' }}
                <span v-if="p.error_code" class="ml-1 text-gray-600">· {{ p.error_code }}</span>
              </span>
              <span class="text-xs text-gray-500">{{ formatDateTime(p.reported_at) }}</span>
            </div>
            <p class="mt-1 whitespace-pre-wrap text-gray-800">{{ p.description }}</p>
            <p class="mt-1 text-xs text-gray-500">
              Reported by {{ p.reporter_name || 'unknown' }} · status {{ p.status }}
            </p>
          </li>
        </ul>
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
          <div v-if="firing.duration_minutes != null">
            <dt class="text-xs font-medium text-gray-500">Duration</dt>
            <dd class="text-sm">{{ formatMinutes(firing.duration_minutes) }}</dd>
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

      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="firing.status === 'open'"
          :to="`/firing/${id}/close`"
          block
          size="lg"
        >
          Close this firing
        </UButton>
        <UButton
          v-else
          :to="`/firing/${id}/problem`"
          variant="outline"
          icon="i-heroicons-bell-alert"
          size="md"
        >
          Report a problem
        </UButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { FiringEntry } from '~/composables/useFirings'
import type { ProblemEntry } from '~/composables/useProblems'
import type { Timestamp, Unsubscribe } from 'firebase/firestore'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { watchFiring } = useFirings()
const { watchProblemsForFiring } = useProblems()

const firing = ref<FiringEntry | null>(null)
const problems = ref<ProblemEntry[]>([])
const loading = ref(true)
let unsubFiring: Unsubscribe | null = null
let unsubProblems: Unsubscribe | null = null

onMounted(() => {
  unsubFiring = watchFiring(id.value, (f) => {
    firing.value = f
    loading.value = false
  })
  unsubProblems = watchProblemsForFiring(id.value, (list) => {
    problems.value = list
  })
})
onBeforeUnmount(() => {
  if (unsubFiring) unsubFiring()
  if (unsubProblems) unsubProblems()
})

function formatDateTime(ts: Timestamp): string {
  return ts.toDate().toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
</script>
