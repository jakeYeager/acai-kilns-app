<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ pageTitle }}</h1>
      <UButton variant="ghost" size="sm" to="/">Cancel</UButton>
    </header>

    <div v-if="!kiln" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      Unknown kiln <code>{{ kilnId }}</code>.
      <UButton class="ml-2" size="sm" variant="ghost" to="/">Back home</UButton>
    </div>

    <form
      v-else
      class="space-y-6 rounded-lg border border-gray-200 bg-white p-4"
      @submit.prevent="onSubmit"
    >
      <section class="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <span class="font-semibold">{{ kiln.display_name }}</span>
        <span class="ml-2 text-xs text-gray-500">{{ kiln.type }}</span>
      </section>

      <div v-if="type === 'error_code'">
        <p class="text-sm font-medium text-gray-700">Error code <span class="text-gray-400">(from kiln controller)</span></p>
        <UInput
          v-model="errorCode"
          placeholder="e.g. E-1, FAIL"
          size="lg"
          class="mt-1"
          required
        />
      </div>

      <div>
        <p class="text-sm font-medium text-gray-700">
          {{ type === 'error_code' ? 'What was happening?' : 'Describe the problem' }}
        </p>
        <UTextarea
          v-model="body"
          :placeholder="bodyPlaceholder"
          :rows="5"
          required
          class="mt-1"
        />
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <UButton type="submit" block size="lg" :loading="submitting" :disabled="!canSubmit">
        Submit report
      </UButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { ProblemType } from '~/composables/useProblems'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const { state: lookupState } = useLookups()
const { reportProblem } = useProblems()

const kilnId = computed(() => String(route.query.kiln || ''))
const type = computed<ProblemType>(() =>
  route.query.type === 'general' ? 'general' : 'error_code'
)
const kiln = computed(() => lookupState.value.kilns.find((k) => k.id === kilnId.value) || null)

const pageTitle = computed(() =>
  type.value === 'error_code' ? 'Report error code' : 'Report problem'
)
const bodyPlaceholder = computed(() =>
  type.value === 'error_code'
    ? 'When the code appeared, what the kiln was doing, anything else useful…'
    : 'What you observed (broken brick, lid misalignment, smell, etc.) and where on the kiln.'
)

const errorCode = ref('')
const body = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

const canSubmit = computed(() => {
  if (!kiln.value || !body.value.trim() || submitting.value) return false
  if (type.value === 'error_code' && !errorCode.value.trim()) return false
  return true
})

async function onSubmit() {
  if (!canSubmit.value || !kiln.value) return
  submitting.value = true
  error.value = null
  try {
    await reportProblem({
      kiln_id: kiln.value.id,
      kiln_type: kiln.value.type,
      type: type.value,
      ...(type.value === 'error_code' ? { error_code: errorCode.value } : {}),
      body: body.value,
    })
    await navigateTo('/')
  } catch (err: any) {
    console.error('[problem/new] submit failed', err)
    error.value = err?.message || 'Failed to submit report.'
  } finally {
    submitting.value = false
  }
}
</script>
