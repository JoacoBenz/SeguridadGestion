import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Escala "ink" para fondos y texto sobre dark
        ink: {
          950: "#070708",
          900: "#0A0A0B",
          850: "#101012",
          800: "#161618",
          700: "#1F1F22",
          600: "#27272A",
          500: "#3F3F46",
          400: "#71717A",
          300: "#A1A1AA",
          200: "#D4D4D8",
          100: "#F4F4F5",
          50: "#FAFAFA",
        },
        accent: {
          DEFAULT: "#FBBF24", // amber-400
          dim: "#B45309", // amber-700
          fg: "#0A0A0B",
        },
        positive: "#34D399",
        critical: "#FB7185",
        warn: "#FB923C",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "slide-in-down": "slide-in-down 220ms ease-out",
        "slide-out-right": "slide-out-right 250ms ease-in forwards",
        "pulse-once": "pulse-once 700ms ease-out 1",
        "scan-line": "scan-line 2.4s ease-in-out infinite",
      },
      keyframes: {
        "slide-in-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-out-right": {
          from: { opacity: "1", transform: "translateX(0)" },
          to: { opacity: "0", transform: "translateX(20px)" },
        },
        "pulse-once": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "scan-line": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
