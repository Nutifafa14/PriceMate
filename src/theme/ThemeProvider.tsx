import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

import { useSettingsStore } from "@/store/settings-store";

import { darkPalette, palette, type Palette } from "./colors";
import { radius, shadow, spacing } from "./spacing";
import { fontFamily, fontSize, lineHeight } from "./typography";

export type Theme = {
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  isDark: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

function buildTheme(isDark: boolean): Theme {
  return {
    colors: isDark ? darkPalette : palette,
    spacing,
    radius,
    shadow,
    fontFamily,
    fontSize,
    lineHeight,
    isDark,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const themeOverride = useSettingsStore((state) => state.themeOverride);
  const isDark = themeOverride === "system" ? scheme === "dark" : themeOverride === "dark";
  const theme = useMemo(() => buildTheme(isDark), [isDark]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
