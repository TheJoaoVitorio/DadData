/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['__fustat_6a44ab', '__fustat_Fallback_6a44ab', 'Fustat', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        abacate: {
          bg: "#F8FAF9",
          card: "#FFFFFF",
          cardHover: "#F4F5F6",
          border: "#E4E4E7",
          borderDark: "#D4D4D8",
          dark: "#18181B",
          surface: "#FFFFFF",
          surfaceLight: "#F4F4F5",
          panel: "#FAFAFA",
          primary: "#FACC15",
          primaryHover: "#EAB308",
          primaryDark: "#CA8A04",
          primaryLight: "#FEF08A",
          primarySubtle: "#FEF9C3",
          forest: "#18181B",
          subtle: "#71717A",
          muted: "#A1A1AA",
        },
        nocra: {
          bg: "#F8FAF9",
          card: "#FFFFFF",
          cardHover: "#F4F5F6",
          dark: "#18181B",
          darkCard: "#FFFFFF",
          darkBorder: "#E4E4E7",
          border: "#E4E4E7",
          subtle: "#71717A",
          muted: "#A1A1AA",
          accent: "#FACC15",
        }
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '20px',
        '3xl': '26px',
        '4xl': '32px'
      },
      boxShadow: {
        'abacate-card': '0 2px 12px -2px rgba(24, 24, 27, 0.05), 0 1px 3px -1px rgba(24, 24, 27, 0.03)',
        'abacate-float': '0 12px 35px -8px rgba(24, 24, 27, 0.12)',
        'abacate-glow': '0 0 20px rgba(250, 204, 21, 0.35)',
        'nocra-card': '0 2px 12px -2px rgba(24, 24, 27, 0.05), 0 1px 3px -1px rgba(24, 24, 27, 0.03)',
        'nocra-float': '0 12px 35px -8px rgba(24, 24, 27, 0.12)',
        'nocra-glow': '0 0 20px rgba(250, 204, 21, 0.35)',
      }
    },
  },
  plugins: [],
}
