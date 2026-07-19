import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, ThemedText } from "@/components/ui";
import { ThemeProvider, useTheme } from "@/theme";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Last line of defense against a white/blank screen crash. Anything that
 * throws during render below this point (a bad API response shape, a null
 * reference in a screen) gets a recoverable fallback instead of taking the
 * whole app down. Hook a real crash reporter's captureException into
 * componentDidCatch when one is wired up — logging to console is the
 * placeholder for now.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      // No guarantee ThemeProvider is still mounted above a crash, so this
      // fallback brings its own — it must never itself throw.
      return (
        <ThemeProvider>
          <ErrorFallback onReset={this.reset} />
        </ThemeProvider>
      );
    }
    return this.props.children;
  }
}

function ErrorFallback({ onReset }: { onReset: () => void }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing.xl,
        gap: theme.spacing.md,
      }}
    >
      <Ionicons name="alert-circle-outline" size={48} color={theme.colors.danger} />
      <ThemedText variant="subtitle" style={{ textAlign: "center" }}>
        Something went wrong
      </ThemedText>
      <ThemedText variant="body" color="muted" style={{ textAlign: "center" }}>
        The app hit an unexpected error. Tapping below returns you to a working screen.
      </ThemedText>
      <Button label="Try again" onPress={onReset} fullWidth={false} />
    </View>
  );
}
