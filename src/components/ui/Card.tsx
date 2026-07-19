import React from "react";
import { View, type ViewProps } from "react-native";

import { useTheme } from "@/theme";

export type CardProps = ViewProps & {
  elevated?: boolean;
  padded?: boolean;
};

export function Card({ elevated = true, padded = true, style, children, ...rest }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.lg,
          borderWidth: theme.isDark ? 1 : 0,
          borderColor: theme.colors.border,
        },
        padded && { padding: theme.spacing.lg },
        elevated && theme.shadow.soft,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
