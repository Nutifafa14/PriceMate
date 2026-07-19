import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "pricemate-auth-token";

// In-memory cache so apiFetch can read the token synchronously on every
// request instead of awaiting SecureStore per call. Populated once at app
// startup by loadToken() (see app/_layout.tsx) and kept in sync by
// setToken/clearToken thereafter.
let cachedToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return cachedToken;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function getCachedToken(): string | null {
  return cachedToken;
}
