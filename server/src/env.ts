import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL", "postgres://localhost:5432/pricemate"),
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET", "dev-only-secret-change-in-production"),
  mlApiUrl: required("ML_API_URL", "http://localhost:8000"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  // Optional — the news feed is disabled gracefully (empty list, not an
  // error) when unset. Never sent to the app; GNews is only ever called
  // from this server. See lib/news-client.ts.
  gnewsApiKey: process.env.GNEWS_API_KEY,
};
