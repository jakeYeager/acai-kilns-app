<template>
  <div class="space-y-6">
    <!-- 1. Loading state -->
    <div v-if="state.loading" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
      Loading…
    </div>

    <!-- 2. Authed + on roster -->
    <template v-else-if="isOnRoster">
      <section class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">
            Welcome, {{ state.member?.display_name }}
          </h1>
          <p class="mt-1 text-sm text-gray-600">
            Signed in as <code class="text-xs">{{ state.user?.email }}</code>
            <span v-if="isAdmin" class="ml-2 rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">admin</span>
          </p>
        </div>
        <UButton size="sm" variant="ghost" @click="onSignOut">
          Sign out
        </UButton>
      </section>

      <section class="rounded-lg border border-gray-200 bg-white p-4">
        <h2 class="text-sm font-medium text-gray-500">Phase 0 / 3a wiring check</h2>
        <ul class="mt-2 space-y-1 text-sm">
          <li>Project: <code class="text-xs">{{ projectId }}</code></li>
          <li>Emulator mode: <code class="text-xs">{{ useEmulators ? 'on' : 'off' }}</code></li>
          <li>Member doc: <code class="text-xs">{{ state.member?.id }}</code></li>
          <li>Role: <code class="text-xs">{{ state.role }}</code></li>
        </ul>
      </section>

      <p class="text-sm text-gray-500">
        Firing flows arrive in phase 4.
      </p>
    </template>

    <!-- 3. Authed but NOT on the roster -->
    <template v-else-if="isOffRoster">
      <section class="rounded-lg border border-amber-200 bg-amber-50 p-4">
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
    </template>

    <!-- 4. Unauthed: landing form -->
    <template v-else>
      <section>
        <h1 class="text-2xl font-semibold">ACAI Kilns</h1>
        <p class="mt-1 text-sm text-gray-600">Sign in with your studio email.</p>
      </section>

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
  </div>
</template>

<script setup lang="ts">
import { sendSignInLinkToEmail } from 'firebase/auth'

const { state, isOnRoster, isOffRoster, isAdmin, signOut } = useCurrentMember()
const config = useRuntimeConfig()

const projectId = computed(
  () => (config.public.firebase as { projectId?: string }).projectId || '—'
)
const useEmulators = computed(() => Boolean(config.public.useEmulators))

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
