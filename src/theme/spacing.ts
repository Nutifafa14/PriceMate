export const radius = {
  sm: 12,
  md: 16,
  lg: 24, // border radius per COLOR_GUIDE.md
  xl: 32,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const shadow = {
  // "Soft elevation only" per COLOR_GUIDE.md
  soft: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;
