<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Start a firing</h1>
      <UButton variant="ghost" size="sm" to="/">Cancel</UButton>
    </header>

    <form class="space-y-6 rounded-lg border border-gray-200 bg-white p-4" @submit.prevent="onSubmit">
      <KilnPicker v-model="kilnId" type="electric" />

      <ProgramPicker v-model="programId" />

      <MemberPicker v-model="loaders" role="loader" label="Loaders" />

      <div>
        <p class="text-sm font-medium text-gray-700">Candle hours <span class="text-gray-400">(optional)</span></p>
        <UInput
          v-model="candleHrsRaw"
          type="number"
          inputmode="decimal"
          step="0.5"
          min="0"
          placeholder="e.g. 4 or 3.5"
          size="lg"
          class="mt-1"
        />
      </div>

      <DateTimePicker v-model="startDateTime" label="Start time" />

      <NotesInput v-model="notes" />

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <UButton
        type="submit"
        block
        size="lg"
        :loading="submitting"
        :disabled="!canSubmit"
      >
        Start firing
      </UButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { FiringMember } from '~/composables/useFirings'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const { state: memberState, isOnRoster } = useCurrentMember()
const { electricPrograms } = useLookups()
const { openElectricFiring } = useFirings()

const kilnFromQuery = typeof route.query.kiln === 'string' ? route.query.kiln : null
const kilnId = ref<string | null>(kilnFromQuery)
const programId = ref<string | null>(null)
const loaders = ref<FiringMember[]>([])
const candleHrsRaw = ref<string>('')
const startDateTime = ref<Date | null>(null)
const notes = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

// Auto-add the authed member as the first loader if they're trained.
watchEffect(() => {
  if (loaders.value.length) return
  const me = memberState.value.member
  if (!me) return
  if (me.training?.electric?.loader !== true) return
  loaders.value = [{ member_id: me.id, display_name: me.display_name }]
})

const canSubmit = computed(() => {
  return Boolean(
    kilnId.value &&
      programId.value &&
      loaders.value.length &&
      startDateTime.value &&
      isOnRoster.value &&
      !submitting.value
  )
})

async function onSubmit() {
  if (!canSubmit.value) return
  const program = electricPrograms.value.find((p) => p.id === programId.value)
  if (!program) {
    error.value = 'Program not found'
    return
  }

  submitting.value = true
  error.value = null
  try {
    const candle_hrs = candleHrsRaw.value ? parseFloat(candleHrsRaw.value) : undefined
    await openElectricFiring({
      kiln_id: kilnId.value!,
      kiln_type: 'electric',
      cone: program.cone,
      program: program.program,
      loaders: loaders.value,
      start_datetime: startDateTime.value!,
      ...(candle_hrs != null && !Number.isNaN(candle_hrs) ? { candle_hrs } : {}),
      ...(notes.value ? { notes: notes.value } : {}),
    })
    await navigateTo('/')
  } catch (err: any) {
    console.error('[firing/new] submit failed', err)
    error.value = err?.message || 'Failed to start firing.'
  } finally {
    submitting.value = false
  }
}
</script>
