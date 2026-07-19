/**
 * Color tokens from COLOR_GUIDE.md.
 * Light theme is the only mode specified by the guide; dark values are
 * derived to keep contrast reasonable and are safe defaults until a
 * dedicated dark palette is signed off in a later phase.
 */
export const palette = {
  primary: "#16213E",
  primaryMuted: "#2A3B63",
  accent: "#F97316",
  accentMuted: "#FDBA74",
  background: "#F8FAFC",
  card: "#FFFFFF",
  text: "#1E293B",
  textMuted: "#64748B",
  textOnPrimary: "#FFFFFF",
  textOnAccent: "#FFFFFF",
  border: "#E2E8F0",
  success: "#16A34A",
  successBg: "#DCFCE7",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
  warning: "#D97706",
  overlay: "rgba(15, 23, 42, 0.55)",
} as const;

export const darkPalette: Palette = {
  primary: "#16213E",
  primaryMuted: "#1F2A47",
  accent: "#F97316",
  accentMuted: "#C2560F",
  background: "#0B1220",
  card: "#141B2E",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  textOnPrimary: "#FFFFFF",
  textOnAccent: "#FFFFFF",
  border: "#26314A",
  success: "#22C55E",
  successBg: "#052E1A",
  danger: "#F87171",
  dangerBg: "#3A0B0B",
  warning: "#FBBF24",
  overlay: "rgba(0, 0, 0, 0.6)",
};

export type Palette = Record<keyof typeof palette, string>;
