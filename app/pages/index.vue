<template>
  <div class="space-y-6">
    <!-- Authed header (welcome + sign out) -->
    <section v-if="isOnRoster" class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">
          Welcome, {{ state.member?.display_name }}
        </h1>
        <p class="mt-1 text-sm text-gray-600">
          Signed in as <code class="text-xs">{{ state.user?.email }}</code>
          <span v-if="isAdmin" class="ml-2 rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">admin</span>
        </p>
      </div>
      <UButton size="sm" variant="ghost" @click="onSignOut">Sign out</UButton>
    </section>

    <!-- Off-roster banner (authed but no member doc) -->
    <section
      v-else-if="isOffRoster"
      class="rounded-lg border border-amber-200 bg-amber-50 p-4"
    >
      <h1 class="text-lg font-semibold text-amber-900">You're not on the roster</h1>
      <p class="mt-1 text-sm text-amber-800">
        You're signed in as <code class="text-xs">{{ state.user?.email }}</code>, but no member record matches that address.
      </p>
      <p class="mt-2 text-sm text-amber-800">
        Ask an admin to add you. Once they do, sign out and back in.
      </p>
      <UButton class="mt-3" size="sm" variant="solid" @click="onSignOut">
        Sign out
      </UButton>
    </section>

    <!-- Public landing header for unauthed visitors -->
    <section v-else>
      <h1 class="text-2xl font-semibold">ACAI Kilns</h1>
      <p class="mt-1 text-sm text-gray-600">
        Live kiln status. Sign in below to start firings or report problems.
      </p>
    </section>

    <!-- Kiln status grid — visible to everyone -->
    <section>
      <h2 class="mb-2 text-sm font-medium text-gray-500">Electric kilns</h2>
      <div v-if="kilnsLoading" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Loading…
      </div>
      <div v-else-if="!electricKilns.length" class="rounded-lg border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
        No active electric kilns.
      </div>
      <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KilnCard
          v-for="kiln in electricKilns"
          :key="kiln.id"
          :kiln="kiln"
          :firing="openFiringsByKiln[kiln.id] || null"
        />
      </div>
    </section>

    <section v-if="!kilnsLoading && gasPropaneKilns.length">
      <h2 class="mb-2 text-sm font-medium text-gray-500">Gas / raku kilns</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <GasKilnCard
          v-for="kiln in gasPropaneKilns"
          :key="kiln.id"
          :kiln="kiln"
          :last-burn="lastBurnByKiln[kiln.id] || null"
          :latest-refill="latestRefillByKiln[kiln.id] || null"
        />
      </div>
    </section>

    <!-- Sign-in form — only for unauthed visitors -->
    <template v-if="!state.loading && !state.user">
      <section
        v-if="linkSent"
        class="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
      >
        <h2 class="text-sm font-medium text-emerald-900">Check your inbox</h2>
        <p class="mt-1 text-sm text-emerald-800">
          We sent a sign-in link to <code class="text-xs">{{ submittedEmail }}</code>.
          Open it on this device to complete sign-in.
        </p>
        <UButton class="mt-3" size="sm" variant="ghost" @click="resetForm">
          Use a different email
        </UButton>
      </section>

      <form
        v-else
        class="space-y-4 rounded-lg border border-gray-200 bg-white p-4"
        @submit.prevent="onSubmit"
      >
        <h2 class="text-sm font-medium text-gray-700">Sign in with your studio email</h2>

        <UFormGroup label="Email" name="email">
          <UInput
            v-model="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
            :disabled="submitting"
          />
        </UFormGroup>

        <div>
          <NuxtTurnstile v-model="turnstileToken" />
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <UButton
          type="submit"
          block
          size="lg"
          :loading="submitting"
          :disabled="!canSubmit"
        >
          Send sign-in link
        </UButton>
      </form>
    </template>

    <!-- Diagnostics (authed only) -->
    <details
      v-if="isOnRoster"
      class="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600"
    >
      <summary class="cursor-pointer text-gray-500">Diagnostics</summary>
      <ul class="mt-2 space-y-1">
        <li>Project: <code>{{ projectId }}</code></li>
        <li>Emulator mode: <code>{{ useEmulators ? 'on' : 'off' }}</code></li>
        <li>Member doc: <code>{{ state.member?.id }}</code></li>
        <li>Role: <code>{{ state.role }}</code></li>
      </ul>
    </details>
  </div>
</template>

<script setup lang="ts">
import { sendSignInLinkToEmail } from 'firebase/auth'

const { state, isOnRoster, isOffRoster, isAdmin, signOut } = useCurrentMember()
const { electricKilns, gasPropaneKilns, state: lookupState } = useLookups()
const { inProgress } = useFirings()
const { recent: recentBurns } = useBurns()
const { latestByKiln: latestRefillByKiln } = useRefills()
const config = useRuntimeConfig()

const projectId = computed(
  () => (config.public.firebase as { projectId?: string }).projectId || '—'
)
const useEmulators = computed(() => Boolean(config.public.useEmulators))
const kilnsLoading = computed(() => lookupState.value.loading)

const openFiringsByKiln = computed(() => {
  const map: Record<string, (typeof inProgress.value)[number]> = {}
  for (const f of inProgress.value) {
    if (!map[f.kiln_id]) map[f.kiln_id] = f
  }
  return map
})

const lastBurnByKiln = computed(() => {
  const map: Record<string, (typeof recentBurns.value)[number]> = {}
  for (const b of recentBurns.value) {
    if (!map[b.kiln_id]) map[b.kiln_id] = b
  }
  return map
})

const email = ref('')
const turnstileToken = ref('')
const submitting = ref(false)
const linkSent = ref(false)
const submittedEmail = ref('')
const error = ref<string | null>(null)

const canSubmit = computed(
  () => Boolean(email.value && turnstileToken.value && !submitting.value)
)

async function onSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = null
  try {
    const { auth } = useFirebase()
    const cleanEmail = email.value.toLowerCase().trim()
    const url = `${window.location.origin}/verify`
    await sendSignInLinkToEmail(auth, cleanEmail, { url, handleCodeInApp: true })
    window.localStorage.setItem('kilns:emailForSignIn', cleanEmail)
    submittedEmail.value = cleanEmail
    linkSent.value = true
  } catch (err: any) {
    console.error('[auth] sendSignInLinkToEmail failed', err)
    error.value = err?.message || 'Failed to send link. Check the email and try again.'
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  email.value = ''
  turnstileToken.value = ''
  linkSent.value = false
  submittedEmail.value = ''
  error.value = null
}

async function onSignOut() {
  await signOut()
}
</script>
