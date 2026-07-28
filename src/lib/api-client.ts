import { API_URL } from "@/constants/config";

import { getCachedToken } from "./token-store";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function extractErrorMessage(rawBody: string, fallback: string): string {
  try {
    const parsed = JSON.parse(rawBody) as { error?: string };
    return typeof parsed.error === "string" ? parsed.error : fallback;
  } catch {
    return rawBody || fallback;
  }
}

/** Thin fetch wrapper — every screen/hook goes through this single seam to reach the Express API. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getCachedToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "");
    throw new ApiError(extractErrorMessage(rawBody, response.statusText), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
