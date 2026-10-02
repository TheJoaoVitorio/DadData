/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nocra: {
          bg: "#F9FAFC",
          card: "#FFFFFF",
          cardHover: "#FAFAFA",
          dark: "#111116",
          darkCard: "#16161D",
          darkBorder: "#272733",
          border: "#E9ECF1",
          subtle: "#71717A",
          muted: "#A1A1AA",
          accent: "#6366F1",
          auraPurple: "#E0D7FE",
          auraPink: "#FCE7F3",
          auraBlue: "#E0F2FE",
          auraMint: "#DCFCE7",
        }
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
        '4xl': '36px'
      },
      boxShadow: {
        'nocra-card': '0 10px 30px -10px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        'nocra-float': '0 20px 45px -12px rgba(100, 116, 139, 0.15)',
        'nocra-glow': '0 0 25px rgba(192, 132, 252, 0.25)',
      }
    },
  },
  plugins: [],
}
