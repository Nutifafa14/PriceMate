import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { User } from "@/types";
import type { SignInFormValues, SignUpFormValues } from "@/utils/validation";

type AuthResponse = { user: User; token: string };

export function useSignIn() {
  return useMutation({
    mutationFn: (values: SignInFormValues) =>
      apiFetch<AuthResponse>("/auth/sign-in", { method: "POST", body: JSON.stringify(values) }),
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: (values: SignUpFormValues) =>
      apiFetch<AuthResponse>("/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({ name: values.fullName, email: values.email, password: values.password }),
      }),
  });
}
