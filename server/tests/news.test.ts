import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const app = createApp();

// GNews is a real, rate-limited third-party API — lib/news-client.ts is
// designed to never throw (missing key, GNews error, or rate limit all
// resolve to an empty array), so this only asserts the resilient contract,
// not real article content, which would make the suite flaky.
describe("GET /api/news", () => {
  it("always 200s with an array, even if the news source is unavailable", async () => {
    const res = await request(app).get("/api/news");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toMatchObject({
        title: expect.any(String),
        url: expect.any(String),
        publishedAt: expect.any(String),
        sourceName: expect.any(String),
      });
    }
  });
});
