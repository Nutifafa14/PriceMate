import { defineConfig } from "vitest/config";

// Integration-style suite against a real Postgres test database (see
// tests/global-setup.ts) rather than a mocked DB layer — fileParallelism and
// isolate are both off so every test file shares the one seeded database and
// the one pg Pool instance safely.
export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_URL: "postgres://localhost:5432/pricemate_test",
      JWT_SECRET: "test-secret",
      ML_API_URL: "http://127.0.0.1:8001",
      NODE_ENV: "test",
    },
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    isolate: false,
    testTimeout: 20000,
  },
});
