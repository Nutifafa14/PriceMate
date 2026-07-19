/**
 * Font is Poppins per COLOR_GUIDE.md, loaded via @expo-google-fonts/poppins
 * in app/_layout.tsx. These family names must match the keys passed to
 * useFonts() there.
 */
export const fontFamily = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const lineHeight = {
  xs: 16,
  sm: 20,
  md: 22,
  lg: 26,
  xl: 28,
  xxl: 34,
  display: 40,
} as const;
