<template>
  <div v-if="isOnRoster">
    <button
      type="button"
      class="-m-2 rounded-md p-2 text-gray-700 hover:bg-gray-100"
      aria-label="Open menu"
      @click="open = true"
    >
      <UIcon name="i-heroicons-bars-3" class="h-6 w-6" />
    </button>

    <USlideover v-model="open">
      <div class="flex h-full flex-col bg-white">
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <span class="text-sm font-medium text-gray-700">Menu</span>
          <button
            type="button"
            class="-m-2 rounded-md p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close menu"
            @click="open = false"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>

        <nav class="flex-1 overflow-y-auto p-2">
          <ul class="space-y-1">
            <li v-for="item in items" :key="item.to">
              <NuxtLink
                :to="item.to"
                class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-gray-100"
                :class="route.path === item.to ? 'bg-primary-50 text-primary-900' : ''"
                @click="open = false"
              >
                <UIcon :name="item.icon" class="h-5 w-5" />
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <div class="border-t border-gray-200 p-2">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-gray-100"
            @click="onSignOut"
          >
            <UIcon name="i-heroicons-arrow-right-on-rectangle" class="h-5 w-5" />
            Sign out
          </button>
        </div>
      </div>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
const { isOnRoster, isAdmin, signOut } = useCurrentMember()
const route = useRoute()

const open = ref(false)

interface NavItem {
  to: string
  label: string
  icon: string
}

const items = computed<NavItem[]>(() => {
  const out: NavItem[] = [
    { to: '/', label: 'Home', icon: 'i-heroicons-home' },
  ]
  if (isAdmin.value) {
    out.push({ to: '/admin/problems', label: 'Triage', icon: 'i-heroicons-bell-alert' })
  }
  return out
})

async function onSignOut() {
  open.value = false
  await signOut()
  await navigateTo('/')
}
</script>
