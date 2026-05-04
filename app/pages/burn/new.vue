<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Log a burn</h1>
      <UButton variant="ghost" color="blue" size="sm" to="/">Cancel</UButton>
    </header>

    <form
      class="space-y-6 rounded-lg border border-gray-200 bg-white p-4"
      @submit.prevent="onSubmit"
    >
      <KilnPicker v-model="kilnId" type="gas_propane" />

      <FiringTypePicker v-model="firingTypeId" />

      <TargetConeInput v-model="targetCone" />

      <MemberPicker v-model="operators" role="operator" label="Operators" />

      <DurationInput
        v-model="durationMinutes"
        @update:started-at="onStopwatchStartedAt"
      />

      <DateTimePicker
        v-if="!stopwatchStartedAt"
        v-model="manualStartDateTime"
        label="Start time"
      />
      <p v-else class="text-xs text-gray-500">
        Start time pinned to stopwatch start ({{ formatStart(stopwatchStartedAt) }}).
      </p>

      <div>
        <p class="text-sm font-medium text-gray-700">
          Time to quartz inversion <span class="text-gray-400">(optional, minutes)</span>
        </p>
        <p class="text-xs text-gray-500">Quartz inversion occurs between 1000–1115°F.</p>
        <UInput
          v-model="timeToQiRaw"
          type="number"
          inputmode="numeric"
          min="0"
          placeholder="e.g. 18"
          size="lg"
          class="mt-1"
        />
      </div>

      <NotesInput v-model="notes" />

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <UButton
        type="submit"
        block
        size="lg"
        :loading="submitting"
        :disabled="!canSubmit"
      >
        Log burn
      </UButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { FiringMember } from '~/composables/useFirings'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const { state: memberState, isOnRoster } = useCurrentMember()
const { rakuFiringTypes } = useLookups()
const { logBurn } = useBurns()

const kilnFromQuery = typeof route.query.kiln === 'string' ? route.query.kiln : null

const kilnId = ref<string | null>(kilnFromQuery)
const firingTypeId = ref<string | null>(null)
const targetCone = ref('')
const operators = ref<FiringMember[]>([])
const durationMinutes = ref<number | null>(null)
const stopwatchStartedAt = ref<Date | null>(null)
const manualStartDateTime = ref<Date | null>(null)
const timeToQiRaw = ref('')
const notes = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

// Auto-add the authed member as the first operator if they're trained.
watchEffect(() => {
  if (operators.value.length) return
  const me = memberState.value.member
  if (!me) return
  if (me.training?.gas_propane?.operator !== true) return
  operators.value = [{ member_id: me.id, display_name: me.display_name }]
})

const durationValid = computed(() =>
  durationMinutes.value != null && durationMinutes.value > 0
)

const canSubmit = computed(() => {
  return Boolean(
    kilnId.value &&
      firingTypeId.value &&
      targetCone.value.trim() &&
      operators.value.length &&
      durationValid.value &&
      (stopwatchStartedAt.value || manualStartDateTime.value) &&
      isOnRoster.value &&
      !submitting.value
  )
})

function onStopwatchStartedAt(value: Date | null) {
  stopwatchStartedAt.value = value
}

function formatStart(d: Date): string {
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function onSubmit() {
  if (!canSubmit.value) return
  const firingType = rakuFiringTypes.value.find((t) => t.id === firingTypeId.value)
  if (!firingType) {
    error.value = 'Firing type not found'
    return
  }
  const start = stopwatchStartedAt.value || manualStartDateTime.value
  if (!start) {
    error.value = 'Start time required'
    return
  }

  submitting.value = true
  error.value = null
  try {
    const time_to_qi = timeToQiRaw.value ? parseInt(timeToQiRaw.value, 10) : undefined
    const burnId = await logBurn({
      kiln_id: kilnId.value!,
      firing_type: firingType.name,
      firing_type_label: firingType.label,
      target_cone: targetCone.value,
      operators: operators.value,
      start_datetime: start,
      duration_minutes: durationMinutes.value!,
      ...(time_to_qi != null && !Number.isNaN(time_to_qi) ? { time_to_qi } : {}),
      ...(notes.value ? { notes: notes.value } : {}),
    })
    await navigateTo(`/burn/${burnId}`)
  } catch (err: any) {
    console.error('[burn/new] submit failed', err)
    error.value = err?.message || 'Failed to log burn.'
  } finally {
    submitting.value = false
  }
}
</script>
