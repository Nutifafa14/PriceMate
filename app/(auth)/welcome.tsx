import { router } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, Screen, ThemedText } from "@/components/ui";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "@/theme";

export default function WelcomeScreen() {
  const theme = useTheme();
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding);

  const onContinue = () => {
    completeOnboarding();
    router.replace("/(auth)/sign-in");
  };

  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.primary,
            borderBottomLeftRadius: theme.radius.xl,
            borderBottomRightRadius: theme.radius.xl,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: theme.spacing.xl,
          }}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: theme.radius.xl,
              backgroundColor: theme.colors.primaryMuted,
              alignItems: "center",
              justifyContent: "center",
              ...theme.shadow.soft,
            }}
          >
            <Ionicons name="trending-up" size={44} color={theme.colors.accent} />
          </View>
          <ThemedText
            variant="display"
            weight="bold"
            color="onPrimary"
            style={{ marginTop: theme.spacing.lg, textAlign: "center" }}
          >
            PriceMate
          </ThemedText>
          <ThemedText
            variant="body"
            color="onPrimary"
            style={{ marginTop: theme.spacing.sm, textAlign: "center", maxWidth: 280, opacity: 0.75 }}
          >
            Track and predict wholesale food prices across Ghana&apos;s markets — built for farmers, traders
            and researchers.
          </ThemedText>
        </View>

        <View style={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: theme.spacing.xl }}>
            <Stat icon="storefront-outline" label="20 markets" />
            <Stat icon="pricetags-outline" label="26 commodities" />
            <Stat icon="calendar-outline" label="2015–2023" />
          </View>
          <Button label="Get Started" variant="accent" onPress={onContinue} />
        </View>
      </View>
    </Screen>
  );
}

function Stat({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", gap: theme.spacing.xs }}>
      <Ionicons name={icon} size={20} color={theme.colors.accent} />
      <ThemedText variant="label" color="muted" style={{ textAlign: "center" }}>
        {label}
      </ThemedText>
    </View>
  );
}
