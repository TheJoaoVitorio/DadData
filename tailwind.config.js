/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Fustat', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        abacate: {
          bg: "#F8FAF9",
          card: "#FFFFFF",
          cardHover: "#F2F6F4",
          border: "#E2E8E5",
          borderDark: "#1E3B3A",
          dark: "#0C1818",
          surface: "#112323",
          surfaceLight: "#183232",
          panel: "#1E3C3C",
          primary: "#00F566",
          primaryHover: "#00DF61",
          primaryDark: "#028A3B",
          forest: "#142929",
          subtle: "#64837E",
          muted: "#8EA8A3",
        },
        nocra: {
          bg: "#F8FAF9",
          card: "#FFFFFF",
          cardHover: "#F2F6F4",
          dark: "#0C1818",
          darkCard: "#112323",
          darkBorder: "#1E3B3A",
          border: "#E2E8E5",
          subtle: "#64837E",
          muted: "#8EA8A3",
          accent: "#00F566",
        }
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '20px',
        '3xl': '26px',
        '4xl': '32px'
      },
      boxShadow: {
        'abacate-card': '0 4px 20px -4px rgba(12, 24, 24, 0.06), 0 2px 6px -1px rgba(12, 24, 24, 0.03)',
        'abacate-float': '0 12px 35px -8px rgba(12, 24, 24, 0.18)',
        'abacate-glow': '0 0 20px rgba(0, 245, 102, 0.35)',
        'nocra-card': '0 4px 20px -4px rgba(12, 24, 24, 0.06), 0 2px 6px -1px rgba(12, 24, 24, 0.03)',
        'nocra-float': '0 12px 35px -8px rgba(12, 24, 24, 0.18)',
        'nocra-glow': '0 0 20px rgba(0, 245, 102, 0.35)',
      }
    },
  },
  plugins: [],
}
