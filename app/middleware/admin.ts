// Route guard for admin-only pages. Builds on `auth` middleware: waits for
// auth state to settle, then redirects non-admins to home. Apply both:
//   definePageMeta({ middleware: ['auth', 'admin'] })

export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return
  const { state, isAdmin } = useCurrentMember()
  if (state.value.loading) return
  if (!isAdmin.value) return navigateTo('/')
})
