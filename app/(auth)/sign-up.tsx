import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, Screen, TextField, ThemedText } from "@/components/ui";
import { useSignUp } from "@/hooks";
import { ApiError } from "@/lib/api-client";
import { setToken } from "@/lib/token-store";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "@/theme";
import { signUpSchema, type SignUpFormValues } from "@/utils/validation";

export default function SignUpScreen() {
  const theme = useTheme();
  const signIn = useAuthStore((state) => state.signIn);
  const signUpMutation = useSignUp();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: SignUpFormValues) => {
    setFormError(null);
    try {
      const { user, token } = await signUpMutation.mutateAsync(values);
      await setToken(token);
      signIn(user);
      router.replace("/(tabs)");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't reach the server. Please try again.");
    }
  };

  return (
    <Screen scroll>
      <View style={{ paddingTop: theme.spacing.xl, gap: theme.spacing.xl }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="trending-up" size={26} color={theme.colors.accent} />
        </View>

        <View>
          <ThemedText variant="title">Register Now</ThemedText>
          <ThemedText variant="body" color="muted" style={{ marginTop: theme.spacing.xs }}>
            Create an account to save favourites and get price predictions.
          </ThemedText>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Full name"
                placeholder="Ama Owusu"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.fullName?.message}
                leftElement={<Ionicons name="person-outline" size={18} color={theme.colors.textMuted} />}
              />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Email"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                leftElement={<Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Password"
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                leftElement={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />}
                rightElement={
                  <Pressable
                    hitSlop={8}
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={theme.colors.textMuted}
                    />
                  </Pressable>
                }
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Confirm password"
                placeholder="••••••••"
                secureTextEntry={!showConfirmPassword}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
                leftElement={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />}
                rightElement={
                  <Pressable
                    hitSlop={8}
                    onPress={() => setShowConfirmPassword((v) => !v)}
                    accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={theme.colors.textMuted}
                    />
                  </Pressable>
                }
              />
            )}
          />
        </View>

        {formError ? (
          <ThemedText variant="caption" color="danger">
            {formError}
          </ThemedText>
        ) : null}

        <Button label="Sign Up" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

        <View style={{ flexDirection: "row", justifyContent: "center", gap: theme.spacing.xs }}>
          <ThemedText variant="body" color="muted">
            Already have an account?
          </ThemedText>
          <Link href="/(auth)/sign-in">
            <ThemedText variant="body" color="accent" weight="semibold">
              Sign In
            </ThemedText>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
