<template>
  <div class="min-h-screen flex flex-col bg-gray-50 text-gray-900">
    <header class="bg-white border-b border-gray-200">
      <div class="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="text-lg font-semibold tracking-tight">
          ACAI Kilns
        </NuxtLink>
        <AppNav />
      </div>
    </header>
    <main class="flex-1 mx-auto w-full max-w-2xl px-4 py-6">
      <slot />
    </main>
    <footer class="border-t border-gray-200 bg-white">
      <div class="mx-auto max-w-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span v-if="state.user">
          Signed in as <code>{{ state.user.email }}</code>
          <span v-if="isAdmin" class="ml-1 rounded bg-primary-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-primary-700">admin</span>
        </span>
        <span v-else>ACAI Studios &amp; Gallery</span>
        <span>{{ envLabel }}</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { state, isAdmin } = useCurrentMember()
const config = useRuntimeConfig()
const envLabel = computed(() => {
  const env = config.public.env || 'dev'
  return config.public.useEmulators ? `${env} · emulator` : env
})
</script>
