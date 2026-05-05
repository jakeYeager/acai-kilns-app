<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">Problem triage</h1>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="opt in filters"
        :key="opt.value"
        type="button"
        class="rounded-full px-3 py-1 text-sm transition"
        :class="filter === opt.value
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
        @click="filter = opt.value"
      >
        {{ opt.label }}
        <span class="ml-1 text-xs opacity-75">{{ counts[opt.value] }}</span>
      </button>
    </div>

    <div v-if="loading" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
      Loading…
    </div>

    <ul v-else-if="visible.length" class="space-y-3">
      <li
        v-for="p in visible"
        :key="p.id"
        class="rounded-lg border bg-white p-4"
        :class="p.severity === 'blocking' ? 'border-red-300' : 'border-gray-200'"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span class="font-semibold">{{ p.kiln_id }}</span>
            <span v-if="p.program_label" class="ml-2 text-sm text-gray-600">
              {{ p.program_label }}
            </span>
            <span class="ml-2 inline-block rounded-full px-2 py-0.5 text-xs"
              :class="p.severity === 'blocking'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-700'"
            >
              {{ p.severity === 'blocking' ? 'Blocking' : 'Observation' }}
            </span>
          </div>
          <span class="text-xs text-gray-500">{{ formatTime(p.reported_at) }}</span>
        </div>

        <div v-if="p.error_code" class="mt-2 text-sm">
          <span class="font-medium text-gray-600">Error code:</span>
          <code class="ml-1 rounded bg-gray-100 px-1.5 py-0.5">{{ p.error_code }}</code>
        </div>

        <p class="mt-2 whitespace-pre-wrap text-sm text-gray-800">{{ p.description }}</p>

        <p class="mt-2 text-xs text-gray-500">
          Reported by {{ p.reporter_name || 'unknown' }}<span v-if="p.firing_id">
            · <NuxtLink class="text-primary-700 hover:underline" :to="`/firing/${p.firing_id}`">
              View firing
            </NuxtLink>
          </span>
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium"
            :class="statusBadge(p.status)"
          >
            {{ p.status }}
          </span>
          <UButton
            v-if="p.status === 'open'"
            size="xs"
            variant="outline"
            :loading="busy === p.id"
            @click="onAcknowledge(p.id)"
          >
            Acknowledge
          </UButton>
          <UButton
            v-if="p.status !== 'resolved'"
            size="xs"
            color="primary"
            :loading="busy === p.id"
            @click="onResolve(p)"
          >
            Resolve
          </UButton>
          <UButton
            v-if="p.status === 'resolved'"
            size="xs"
            variant="ghost"
            color="blue"
            :loading="busy === p.id"
            @click="onReopen(p.id)"
          >
            Reopen
          </UButton>
        </div>

        <div v-if="p.status === 'resolved'" class="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
          <div>
            Resolved {{ p.resolved_at ? formatTime(p.resolved_at) : '' }}
          </div>
          <p v-if="p.resolution_notes" class="mt-1 whitespace-pre-wrap">
            {{ p.resolution_notes }}
          </p>
        </div>
      </li>
    </ul>

    <div v-else class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
      Nothing here.
    </div>

    <UModal v-model="resolveOpen">
      <div class="p-4 space-y-4">
        <h2 class="text-lg font-semibold">Resolve problem</h2>
        <p class="text-sm text-gray-600">Optional: what did you do about it?</p>
        <UTextarea
          v-model="resolveNotes"
          :rows="4"
          placeholder="Replaced thermocouple, tightened lid latch, etc."
        />
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="blue" @click="resolveOpen = false">Cancel</UButton>
          <UButton :loading="!!busy" @click="confirmResolve">Resolve</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ProblemEntry, ProblemStatus } from '~/composables/useProblems'
import type { Timestamp, Unsubscribe } from 'firebase/firestore'

definePageMeta({ middleware: ['auth', 'admin'] })

const { watchProblems, acknowledgeProblem, resolveProblem, reopenProblem } = useProblems()

const all = ref<ProblemEntry[]>([])
const loading = ref(true)
let unsub: Unsubscribe | null = null

onMounted(() => {
  unsub = watchProblems((list) => {
    all.value = list
    loading.value = false
  })
})
onBeforeUnmount(() => { if (unsub) unsub() })

type Filter = ProblemStatus | 'all'
const filter = ref<Filter>('open')
const filters: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]

const counts = computed<Record<Filter, number>>(() => ({
  open: all.value.filter((p) => p.status === 'open').length,
  acknowledged: all.value.filter((p) => p.status === 'acknowledged').length,
  resolved: all.value.filter((p) => p.status === 'resolved').length,
  all: all.value.length,
}))

const visible = computed(() =>
  filter.value === 'all' ? all.value : all.value.filter((p) => p.status === filter.value)
)

const busy = ref<string | null>(null)
const resolveOpen = ref(false)
const resolveTarget = ref<ProblemEntry | null>(null)
const resolveNotes = ref('')

async function onAcknowledge(id: string) {
  busy.value = id
  try { await acknowledgeProblem(id) } finally { busy.value = null }
}

function onResolve(p: ProblemEntry) {
  resolveTarget.value = p
  resolveNotes.value = p.resolution_notes ?? ''
  resolveOpen.value = true
}

async function confirmResolve() {
  if (!resolveTarget.value) return
  busy.value = resolveTarget.value.id
  try {
    await resolveProblem(resolveTarget.value.id, {
      ...(resolveNotes.value.trim() ? { resolution_notes: resolveNotes.value } : {}),
    })
    resolveOpen.value = false
    resolveTarget.value = null
    resolveNotes.value = ''
  } finally {
    busy.value = null
  }
}

async function onReopen(id: string) {
  busy.value = id
  try { await reopenProblem(id) } finally { busy.value = null }
}

function statusBadge(s: ProblemStatus): string {
  if (s === 'open') return 'bg-red-100 text-red-800'
  if (s === 'acknowledged') return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
}

function formatTime(ts: Timestamp): string {
  return ts.toDate().toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
</script>
