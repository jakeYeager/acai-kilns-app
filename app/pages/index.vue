<template>
  <div class="space-y-6">
    <section>
      <h1 class="text-2xl font-semibold">Home</h1>
      <p class="mt-1 text-sm text-gray-600">
        Phase 0 scaffold. Auth and firing flows arrive in later phases.
      </p>
    </section>

    <section class="rounded-lg border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-medium text-gray-500">Firebase wiring check</h2>
      <ul class="mt-2 space-y-1 text-sm">
        <li>Project ID: <code class="text-xs">{{ projectId }}</code></li>
        <li>Emulator mode: <code class="text-xs">{{ useEmulators ? 'on' : 'off' }}</code></li>
        <li v-if="firebaseReady">Auth + Firestore: <code class="text-xs">ready</code></li>
        <li v-else>Auth + Firestore: <code class="text-xs">initializing…</code></li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const projectId = computed(() => (config.public.firebase as { projectId?: string }).projectId || '—')
const useEmulators = computed(() => Boolean(config.public.useEmulators))

const firebaseReady = ref(false)
onMounted(() => {
  const fb = useFirebase()
  firebaseReady.value = Boolean(fb?.auth && fb?.firestore)
})
</script>
