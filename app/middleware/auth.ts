// Route guard for pages that require an authed, on-roster member.
// Waits for the Firebase Auth state to resolve before deciding so
// hard-refreshes don't bounce to / before claims are restored.
//
// Apply to a page via `definePageMeta({ middleware: ['auth'] })`.

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const { state, isOnRoster, isOffRoster } = useCurrentMember()

  if (state.value.loading) {
    await new Promise<void>((resolve) => {
      const stop = watch(
        () => state.value.loading,
        (loading) => {
          if (!loading) {
            stop()
            resolve()
          }
        },
        { immediate: true }
      )
    })
  }

  if (!state.value.user) {
    return navigateTo({ path: '/', query: { next: to.fullPath } })
  }

  if (isOffRoster.value) {
    return navigateTo('/')
  }

  if (!isOnRoster.value) {
    // Edge case: user resolved but member doc not yet matched. Send home
    // to display either the off-roster screen or the loading state.
    return navigateTo('/')
  }
})
