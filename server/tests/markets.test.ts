import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const app = createApp();

describe("GET /api/markets", () => {
  it("returns all 30 seeded markets", async () => {
    const res = await request(app).get("/api/markets");
    expect(res.status).toBe(200);
    // 20 WFP-derived markets + 10 new named markets from the MoFA
    // community-prices import — see data/reports/MOFA_CLEANING_CHANGELOG.md.
    expect(res.body).toHaveLength(30);
    expect(res.body[0]).toMatchObject({ name: expect.any(String), region: expect.any(String) });
  });

  it("filters by region", async () => {
    const res = await request(app).get("/api/markets").query({ region: "GREATER ACCRA" });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((m: { region: string }) => m.region === "GREATER ACCRA")).toBe(true);
  });

  it("returns an empty array for a region with no markets", async () => {
    const res = await request(app).get("/api/markets").query({ region: "NOT A REAL REGION" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/markets/:id", () => {
  it("returns a single market by id", async () => {
    const all = await request(app).get("/api/markets");
    const target = all.body[0];
    const res = await request(app).get(`/api/markets/${target.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(target);
  });

  it("404s for a well-formed id that doesn't exist", async () => {
    const res = await request(app).get("/api/markets/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("400s for a malformed id", async () => {
    const res = await request(app).get("/api/markets/not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });
});
