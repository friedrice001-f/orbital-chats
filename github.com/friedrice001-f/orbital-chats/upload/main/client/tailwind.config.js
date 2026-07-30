/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Bright mode
        "surface-bright": "#FFFFFF",
        "surface-bright-soft": "#F8FAFC",
        "text-bright": "#0F172A",
        "bubble-sender-bright": "#DCEBFF", // soft pastel blue
        "bubble-receiver-bright": "#EEF1F5", // light gray

        // Dark mode
        "surface-dark": "#090D16",
        "surface-dark-soft": "#10151F",
        "text-dark": "#F1F5F9",
        "bubble-sender-dark": "#161B2E",
        "bubble-receiver-dark": "#12161F",

        // Glow accents (dark mode borders)
        "glow-cyan": "#22D3EE",
        "glow-violet": "#A78BFA",
      },
      boxShadow: {
        "glow-cyan": "0 0 0 1px rgba(34,211,238,0.35), 0 0 16px rgba(34,211,238,0.25)",
        "glow-violet": "0 0 0 1px rgba(167,139,250,0.35), 0 0 16px rgba(167,139,250,0.25)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
