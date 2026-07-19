import { Link, Stack } from "expo-router";
import { View } from "react-native";

import { Button, Screen, ThemedText } from "@/components/ui";
import { useTheme } from "@/theme";

export default function NotFoundScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md }}>
          <ThemedText variant="title">This screen doesn&apos;t exist.</ThemedText>
          <Link href="/" asChild>
            <Button label="Go to home screen" variant="primary" fullWidth={false} />
          </Link>
        </View>
      </Screen>
    </>
  );
}
