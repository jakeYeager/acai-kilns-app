<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="bg-white border-b border-gray-200">
      <div class="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="text-lg font-semibold tracking-tight">
          ACAI Kilns
        </NuxtLink>
        <span class="text-xs text-gray-500">{{ envLabel }}</span>
      </div>
    </header>
    <main class="mx-auto max-w-2xl px-4 py-6">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const envLabel = computed(() => {
  const env = config.public.env || 'dev'
  return config.public.useEmulators ? `${env} · emulator` : env
})
</script>
