import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warna per tenant (sesuai seed.sql)
        tenant: {
          bagia:  '#D97706', // amber
          tl:     '#DC2626', // red
          hibiro: '#1D4ED8', // blue
          ramen:  '#16A34A', // green
          tjan:   '#6B7280', // gray (pause)
        },
        // Warna alert sistem
        alert: {
          red:    '#EF4444',
          yellow: '#F59E0B',
          green:  '#22C55E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      // Ukuran layar kasir/dapur (HP standard)
      screens: {
        xs: '375px',
      },
      // Spacing untuk bottom nav (agar konten tidak tertutup)
      spacing: {
        'nav': '4.5rem', // 72px — tinggi bottom nav
      },
    },
  },
  plugins: [],
}

export default config
