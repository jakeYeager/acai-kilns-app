<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Close firing</h1>
      <UButton variant="ghost" size="sm" :to="`/firing/${id}`">Cancel</UButton>
    </header>

    <div v-if="loading" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
      Loading…
    </div>

    <div v-else-if="!firing" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      Firing not found.
      <UButton class="ml-2" size="sm" variant="ghost" to="/">Back home</UButton>
    </div>

    <div v-else-if="firing.status !== 'open'" class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      This firing is already closed.
      <UButton class="ml-2" size="sm" variant="ghost" :to="`/firing/${id}`">View details</UButton>
    </div>

    <form v-else class="space-y-6 rounded-lg border border-gray-200 bg-white p-4" @submit.prevent="onSubmit">
      <section class="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <span class="font-semibold">{{ firing.kiln_id }}</span>
        <span v-if="firing.program_label" class="ml-2 text-gray-600">{{ firing.program_label }}</span>
        <span class="ml-2 text-xs text-gray-500">started {{ formatStart(firing.start_datetime) }}</span>
      </section>

      <MemberPicker v-model="unloaders" role="unloader" label="Unloaders" />

      <div>
        <p class="text-sm font-medium text-gray-700">Unload temperature (°F) <span class="text-gray-400">(optional)</span></p>
        <UInput
          v-model="unloadTempRaw"
          type="number"
          inputmode="numeric"
          placeholder="e.g. 149"
          size="lg"
          class="mt-1"
        />
      </div>

      <DateTimePicker v-model="unloadDateTime" label="Unload time" />

      <div>
        <p class="text-sm font-medium text-gray-700">Firing duration <span class="text-gray-400">(HH:MM)</span></p>
        <p class="text-xs text-gray-500">From the kiln controller display.</p>
        <UInput
          v-model="firingHhMm"
          placeholder="e.g. 12:23"
          inputmode="numeric"
          required
          size="lg"
          class="mt-1"
        />
      </div>

      <NotesInput v-model="notes" />

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <UButton type="submit" block size="lg" :loading="submitting" :disabled="!canSubmit">
        Close firing
      </UButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { FiringEntry, FiringMember } from '~/composables/useFirings'
import type { Timestamp, Unsubscribe } from 'firebase/firestore'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { state: memberState } = useCurrentMember()
const { closeElectricFiring, watchFiring } = useFirings()

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

const unloaders = ref<FiringMember[]>([])
const unloadTempRaw = ref('')
const unloadDateTime = ref<Date | null>(null)
const firingHhMm = ref('')
const notes = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

// Auto-add authed member if they're a trained unloader and the picker is empty.
watchEffect(() => {
  if (unloaders.value.length) return
  const me = memberState.value.member
  if (!me) return
  if (me.training?.electric?.unloader !== true) return
  unloaders.value = [{ member_id: me.id, display_name: me.display_name }]
})

// Pre-fill notes from existing firing once loaded.
watchEffect(() => {
  if (!firing.value || notes.value) return
  if (firing.value.notes) notes.value = firing.value.notes
})

const hhMmPattern = /^\d{1,3}:\d{1,2}(?::\d{1,2})?$/
const firingHhMmValid = computed(() => hhMmPattern.test(firingHhMm.value.trim()))

const canSubmit = computed(() => {
  return Boolean(
    firing.value &&
      unloaders.value.length &&
      unloadDateTime.value &&
      firingHhMmValid.value &&
      !submitting.value
  )
})

async function onSubmit() {
  if (!canSubmit.value || !firing.value) return
  submitting.value = true
  error.value = null
  try {
    const unload_temp = unloadTempRaw.value ? parseFloat(unloadTempRaw.value) : undefined
    await closeElectricFiring(id.value, {
      unloaders: unloaders.value,
      unload_datetime: unloadDateTime.value!,
      ...(unload_temp != null && !Number.isNaN(unload_temp) ? { unload_temp } : {}),
      firing_hh_mm: firingHhMm.value.trim(),
      ...(notes.value ? { notes: notes.value } : {}),
    })
    await navigateTo(`/firing/${id.value}`)
  } catch (err: any) {
    console.error('[firing/close] submit failed', err)
    error.value = err?.message || 'Failed to close firing.'
  } finally {
    submitting.value = false
  }
}

function formatStart(ts: Timestamp): string {
  const d = ts.toDate()
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>
