/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          indigo: '#4A3AFF',
          terracotta: '#C65D3B',
        },
        accent: {
          marigold: '#F2A93B',
        },
        success: {
          sage: '#6B8F71',
        },
        bg: {
          light: '#FAF6F0',
          dark: '#1A1A1D',
        }
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
