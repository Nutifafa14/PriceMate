import React, { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/theme";

import { ThemedText } from "./ThemedText";

type Variant = "primary" | "accent" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

export type ButtonProps = Omit<PressableProps, "style"> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZE_HEIGHT: Record<Size, number> = { sm: 40, md: 52, lg: 60 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = true,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const [scale] = useState(() => new Animated.Value(1));

  const animateTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const handlePressIn = (e: GestureResponderEvent) => {
    animateTo(0.96);
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    animateTo(1);
    onPressOut?.(e);
  };

  const backgroundColor: Record<Variant, string> = {
    primary: theme.colors.primary,
    accent: theme.colors.accent,
    outline: "transparent",
    ghost: "transparent",
  };
  const textColor: Record<Variant, "onPrimary" | "onAccent" | "primary" | "accent"> = {
    primary: "onPrimary",
    accent: "onAccent",
    outline: "primary",
    ghost: "accent",
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.base,
        {
          height: SIZE_HEIGHT[size],
          borderRadius: theme.radius.pill,
          backgroundColor: backgroundColor[variant],
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: theme.colors.primary,
          opacity: isDisabled ? 0.6 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          paddingHorizontal: theme.spacing.lg,
          transform: [{ scale }],
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "primary" || variant === "accent" ? theme.colors.textOnPrimary : theme.colors.primary
          }
        />
      ) : (
        <ThemedText variant="subtitle" weight="semibold" color={textColor[variant]}>
          {label}
        </ThemedText>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
});
