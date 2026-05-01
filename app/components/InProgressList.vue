<template>
  <section class="space-y-2">
    <h2 class="text-sm font-medium text-gray-500">In progress</h2>

    <div v-if="inProgressLoading" class="text-sm text-gray-500">Loading…</div>

    <div v-else-if="!inProgress.length" class="rounded-lg border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
      No firings in progress.
    </div>

    <ul v-else class="space-y-2">
      <li v-for="firing in inProgress" :key="firing.id">
        <NuxtLink
          :to="`/firing/${firing.id}/close`"
          class="block rounded-lg border border-gray-200 bg-white p-3 hover:border-orange-300"
        >
          <div class="flex items-baseline justify-between">
            <div>
              <span class="text-base font-semibold">{{ firing.kiln_id }}</span>
              <span v-if="firing.program_label" class="ml-2 text-sm text-gray-600">
                {{ firing.program_label }}
              </span>
            </div>
            <span class="text-xs text-gray-500">{{ elapsed(firing.start_datetime) }}</span>
          </div>
          <p v-if="loaderNames(firing).length" class="mt-1 text-xs text-gray-600">
            Loaded by {{ loaderNames(firing).join(', ') }}
          </p>
          <p v-if="firing.candle_hrs != null" class="mt-1 text-xs text-gray-500">
            Candle: {{ firing.candle_hrs }} hr
          </p>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { FiringEntry } from '~/composables/useFirings'
import type { Timestamp } from 'firebase/firestore'

const { inProgress, inProgressLoading } = useFirings()

const now = ref(new Date())
let interval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  interval = setInterval(() => { now.value = new Date() }, 60_000)
})
onBeforeUnmount(() => {
  if (interval) clearInterval(interval)
})

function elapsed(ts: Timestamp): string {
  if (!ts?.toDate) return ''
  const minutes = Math.max(0, Math.round((now.value.getTime() - ts.toDate().getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function loaderNames(firing: FiringEntry): string[] {
  return (firing.loaders || []).map((l) => l.display_name)
}
</script>
