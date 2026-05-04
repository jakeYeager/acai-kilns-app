<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-semibold">Signing you in…</h1>

    <div v-if="status === 'completing'" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Verifying your sign-in link…
    </div>

    <div
      v-else-if="status === 'needs-email'"
      class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <p>
        We need to confirm the email this link was sent to. Open the link on the
        same device you requested it from, or enter the email below.
      </p>
      <form class="mt-3 space-y-3" @submit.prevent="completeWithProvidedEmail">
        <UFormGroup label="Email">
          <UInput v-model="manualEmail" type="email" required />
        </UFormGroup>
        <UButton type="submit" size="sm">Continue</UButton>
      </form>
    </div>

    <div
      v-else-if="status === 'error'"
      class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <p class="font-medium">Sign-in failed.</p>
      <p class="mt-1">{{ errorMessage }}</p>
      <UButton class="mt-3" size="sm" variant="ghost" color="blue" @click="goHome">
        Back to home
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'

definePageMeta({ public: true })

const status = ref<'completing' | 'needs-email' | 'error'>('completing')
const errorMessage = ref('')
const manualEmail = ref('')

async function attempt(email: string) {
  const { auth } = useFirebase()
  try {
    await signInWithEmailLink(auth, email, window.location.href)
    window.localStorage.removeItem('kilns:emailForSignIn')
    await navigateTo('/')
  } catch (err: any) {
    console.error('[auth] signInWithEmailLink failed', err)
    status.value = 'error'
    errorMessage.value =
      err?.code === 'auth/invalid-action-code'
        ? 'This sign-in link has already been used or has expired. Request a new one from the home screen.'
        : err?.message || 'Could not complete sign-in. Request a new link from the home screen.'
  }
}

async function completeWithProvidedEmail() {
  const cleaned = manualEmail.value.toLowerCase().trim()
  if (!cleaned) return
  status.value = 'completing'
  await attempt(cleaned)
}

function goHome() {
  return navigateTo('/')
}

onMounted(async () => {
  const { auth } = useFirebase()
  if (!isSignInWithEmailLink(auth, window.location.href)) {
    status.value = 'error'
    errorMessage.value = 'This link is not a valid sign-in link.'
    return
  }
  const stored = window.localStorage.getItem('kilns:emailForSignIn')
  if (stored) {
    await attempt(stored)
  } else {
    status.value = 'needs-email'
  }
})
</script>
