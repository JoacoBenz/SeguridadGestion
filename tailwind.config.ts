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
        "backdrop-in": "backdrop-in 180ms ease-out forwards",
        "success-pop": "success-pop 520ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "check-stroke": "check-stroke 360ms ease-out 160ms forwards",
        "halo-ring": "halo-ring 900ms ease-out forwards",
        "fade-rise": "fade-rise 360ms ease-out forwards",
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
        "backdrop-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "success-pop": {
          "0%": { opacity: "0", transform: "scale(0.55)" },
          "60%": { opacity: "1", transform: "scale(1.08)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "check-stroke": {
          from: { strokeDashoffset: "30" },
          to: { strokeDashoffset: "0" },
        },
        "halo-ring": {
          "0%": { opacity: "0.7", transform: "scale(0.6)" },
          "100%": { opacity: "0", transform: "scale(1.6)" },
        },
        "fade-rise": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
