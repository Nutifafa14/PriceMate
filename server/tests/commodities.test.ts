import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const app = createApp();

const CATEGORY_VALUES = [
  "cereals and tubers",
  "vegetables and fruits",
  "meat, fish and eggs",
  "pulses and nuts",
] as const;

describe("GET /api/commodities", () => {
  it("returns all 26 seeded commodities", async () => {
    const res = await request(app).get("/api/commodities");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(26);
  });

  it("filters by category", async () => {
    const res = await request(app).get("/api/commodities").query({ category: "pulses and nuts" });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((c: { category: string }) => c.category === "pulses and nuts")).toBe(true);
  });

  it("400s for a category outside the fixed enum", async () => {
    const res = await request(app).get("/api/commodities").query({ category: "snacks" });
    expect(res.status).toBe(400);
  });

  it("every seeded commodity falls into one of the 4 known categories", async () => {
    const res = await request(app).get("/api/commodities");
    for (const c of res.body) {
      expect(CATEGORY_VALUES).toContain(c.category);
    }
  });
});

describe("GET /api/commodities/:id", () => {
  it("returns a single commodity by id", async () => {
    const all = await request(app).get("/api/commodities");
    const target = all.body[0];
    const res = await request(app).get(`/api/commodities/${target.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(target);
  });

  it("404s for a well-formed id that doesn't exist", async () => {
    const res = await request(app).get("/api/commodities/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});
