import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        // Kiln Fire brand teal. 500 is anchored to the brand hex; the rest
        // are an HSL-walked palette so Nuxt UI's semantic shades (focus
        // rings, hover states, etc.) all read as the same family.
        kiln: {
          50: '#F5F9FA',
          100: '#EBF3F4',
          200: '#D2E2E4',
          300: '#B1CACE',
          400: '#89ADB3',
          500: '#649199',
          600: '#527C84',
          700: '#3F6369',
          800: '#2F4C51',
          900: '#20383C',
          950: '#132225',
        },
      },
    },
  },
}
