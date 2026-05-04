<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Log tank refill</h1>
      <UButton variant="ghost" color="blue" size="sm" to="/">Cancel</UButton>
    </header>

    <form
      class="space-y-6 rounded-lg border border-gray-200 bg-white p-4"
      @submit.prevent="onSubmit"
    >
      <KilnPicker v-model="kilnId" type="gas_propane" />

      <DateTimePicker v-model="refilledAt" label="Refilled at" />

      <div>
        <p class="text-sm font-medium text-gray-700">Gallons</p>
        <UInput
          v-model="gallonsRaw"
          type="number"
          inputmode="decimal"
          step="0.1"
          min="0"
          placeholder="e.g. 4.6"
          size="lg"
          class="mt-1"
          required
        />
      </div>

      <div>
        <p class="text-sm font-medium text-gray-700">Cost <span class="text-gray-400">(optional, USD)</span></p>
        <UInput
          v-model="costRaw"
          type="number"
          inputmode="decimal"
          step="0.01"
          min="0"
          placeholder="e.g. 17.40"
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
        Log refill
      </UButton>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const { isOnRoster } = useCurrentMember()
const { logRefill } = useRefills()

const kilnFromQuery = typeof route.query.kiln === 'string' ? route.query.kiln : null

const kilnId = ref<string | null>(kilnFromQuery)
const refilledAt = ref<Date | null>(null)
const gallonsRaw = ref('')
const costRaw = ref('')
const notes = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

const canSubmit = computed(() => {
  const gal = parseFloat(gallonsRaw.value)
  return Boolean(
    kilnId.value &&
      refilledAt.value &&
      !Number.isNaN(gal) &&
      gal > 0 &&
      isOnRoster.value &&
      !submitting.value
  )
})

async function onSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = null
  try {
    const gallons = parseFloat(gallonsRaw.value)
    const cost = costRaw.value ? parseFloat(costRaw.value) : undefined
    const refillId = await logRefill({
      kiln_id: kilnId.value!,
      refilled_at: refilledAt.value!,
      gallons,
      ...(cost != null && !Number.isNaN(cost) ? { cost } : {}),
      ...(notes.value ? { notes: notes.value } : {}),
    })
    await navigateTo(`/refill/${refillId}`)
  } catch (err: any) {
    console.error('[refill/new] submit failed', err)
    error.value = err?.message || 'Failed to log refill.'
  } finally {
    submitting.value = false
  }
}
</script>
