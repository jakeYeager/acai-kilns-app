<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">Report a problem</h1>

    <div v-if="loading" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
      Loading…
    </div>

    <div v-else-if="!firing" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      Firing not found.
      <UButton class="ml-2" size="sm" variant="ghost" color="blue" to="/">Back home</UButton>
    </div>

    <form
      v-else
      class="space-y-6 rounded-lg border border-gray-200 bg-white p-4"
      @submit.prevent="onSubmit"
    >
      <section class="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <span class="font-semibold">{{ firing.kiln_id }}</span>
        <span v-if="firing.program_label" class="ml-2 text-gray-600">{{ firing.program_label }}</span>
        <span class="ml-2 text-xs text-gray-500">started {{ formatStart(firing.start_datetime) }}</span>
      </section>

      <div>
        <p class="text-sm font-medium text-gray-700">How urgent?</p>
        <div class="mt-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-sm transition"
            :class="severity === 'blocking'
              ? 'border-red-500 bg-red-50 text-red-900'
              : 'border-gray-200 bg-white text-gray-700'"
            @click="severity = 'blocking'"
          >
            Blocking
            <span class="block text-xs text-gray-500">Kiln unusable</span>
          </button>
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-sm transition"
            :class="severity === 'non_blocking'
              ? 'border-primary-500 bg-primary-50 text-primary-900'
              : 'border-gray-200 bg-white text-gray-700'"
            @click="severity = 'non_blocking'"
          >
            Observation
            <span class="block text-xs text-gray-500">Wear, brick, etc.</span>
          </button>
        </div>
      </div>

      <div>
        <p class="text-sm font-medium text-gray-700">
          Error code <span class="text-gray-400">(optional)</span>
        </p>
        <p class="text-xs text-gray-500">If shown on the controller.</p>
        <UInput
          v-model="errorCode"
          placeholder="e.g. E-1, FAIL"
          size="lg"
          class="mt-1"
        />
      </div>

      <div>
        <p class="text-sm font-medium text-gray-700">What did you observe?</p>
        <UTextarea
          v-model="description"
          placeholder="When it happened, what the kiln was doing, where on the kiln, anything else useful…"
          :rows="5"
          required
          class="mt-1"
        />
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <UButton type="submit" block size="lg" :loading="submitting" :disabled="!canSubmit">
        Submit report
      </UButton>
      <div class="text-center">
        <UButton variant="ghost" color="blue" size="sm" :to="`/firing/${id}`">Cancel</UButton>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { FiringEntry } from '~/composables/useFirings'
import type { ProblemSeverity } from '~/composables/useProblems'
import type { Timestamp, Unsubscribe } from 'firebase/firestore'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { state: lookupState } = useLookups()
const { watchFiring } = useFirings()
const { reportProblem } = useProblems()

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

const severity = ref<ProblemSeverity>(
  route.query.severity === 'non_blocking' ? 'non_blocking' : 'blocking'
)
const errorCode = ref('')
const description = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

const canSubmit = computed(() =>
  Boolean(firing.value && description.value.trim() && !submitting.value)
)

const kilnType = computed(() => {
  const k = lookupState.value.kilns.find((x) => x.id === firing.value?.kiln_id)
  return k?.type ?? 'electric'
})

async function onSubmit() {
  if (!canSubmit.value || !firing.value) return
  submitting.value = true
  error.value = null
  try {
    await reportProblem({
      kiln_id: firing.value.kiln_id,
      kiln_type: kilnType.value,
      firing_id: id.value,
      ...(firing.value.program_label ? { program_label: firing.value.program_label } : {}),
      severity: severity.value,
      ...(errorCode.value.trim() ? { error_code: errorCode.value } : {}),
      description: description.value,
    })
    await navigateTo(`/firing/${id.value}`)
  } catch (err: any) {
    console.error('[firing/problem] submit failed', err)
    error.value = err?.message || 'Failed to submit report.'
  } finally {
    submitting.value = false
  }
}

function formatStart(ts: Timestamp): string {
  const d = ts.toDate()
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>
