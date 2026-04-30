export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  compatibilityDate: '2026-04-30',

  future: {
    compatibilityVersion: 4,
  },

  nitro: {
    preset: 'static',
  },

  modules: [
    '@nuxt/ui',
    '@nuxtjs/turnstile',
    '@vite-pwa/nuxt',
  ],

  runtimeConfig: {
    turnstile: {
      secretKey: '',
    },
    public: {
      appUrl: '',
      env: 'dev',
      useEmulators: false,
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
      },
    },
  },

  turnstile: {
    siteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY,
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'ACAI Kilns',
      short_name: 'Kilns',
      description: 'Kiln firing logger for ACAI Studios & Gallery',
      theme_color: '#7c2d12',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: [],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
    },
    devOptions: {
      enabled: false,
    },
  },

  app: {
    head: {
      title: 'ACAI Kilns',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
