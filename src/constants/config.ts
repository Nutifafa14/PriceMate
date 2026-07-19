/**
 * Backend base URL. `EXPO_PUBLIC_`-prefixed env vars are inlined at build
 * time by Expo (no native rebuild needed) — set `EXPO_PUBLIC_API_URL` in
 * `.env` for local dev, or per-environment in EAS build profiles for
 * staging/production. See DEPLOYMENT.md.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";

/**
 * Shown wherever a query against API_URL fails outright (not a 4xx/5xx from
 * a reachable server — a network-level failure). The single most common
 * cause: testing on a physical device where "localhost" resolves to the
 * phone itself, not the computer running the API. Named and explained here
 * once so every screen's error state gives the same, actionable hint.
 */
export const API_UNREACHABLE_HINT =
  "Check that the API server is running. On a physical device, \"localhost\" won't work — set EXPO_PUBLIC_API_URL to your computer's LAN IP (e.g. http://192.168.1.23:4000/api) in .env and restart the app.";
