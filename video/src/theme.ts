import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";

const geist = loadGeist();
const geistMono = loadGeistMono();

export const FONT = geist.fontFamily;
export const MONO = geistMono.fontFamily;

// Misma paleta "ink" + accent que tailwind.config.ts de la app.
export const C = {
  bg: "#0A0A0B",
  bgDeep: "#070708",
  card: "#101012",
  cardAlt: "#161618",
  border: "#1F1F22",
  borderLight: "#3F3F46",
  text: "#F4F4F5",
  textSoft: "#A1A1AA",
  textDim: "#71717A",
  accent: "#FBBF24",
  accentFg: "#0A0A0B",
  positive: "#34D399",
  critical: "#FB7185",
  warn: "#FB923C",
  whatsapp: "#25D366",
  waBg: "#0B141A",
  waHeader: "#1F2C34",
  waBubble: "#1F2C34",
} as const;
