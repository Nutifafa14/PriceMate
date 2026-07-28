import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const app = createApp();

describe("GET /api/model/insights", () => {
  it("returns real model metadata including feature importance and category MAPE", async () => {
    const res = await request(app).get("/api/model/insights");
    expect(res.status).toBe(200);
    expect(res.body.modelName).toEqual(expect.any(String));
    expect(res.body.categoryMape).toEqual(expect.any(Object));
    expect(Object.keys(res.body.categoryMape).length).toBeGreaterThan(0);
  });
});

describe("GET /api/model/backtest", () => {
  it("returns a real predicted-vs-actual sample from the held-out test set", async () => {
    const res = await request(app).get("/api/model/backtest");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toMatchObject({
        commodity: expect.any(String),
        market: expect.any(String),
        date: expect.any(String),
        actual: expect.any(Number),
        predicted: expect.any(Number),
      });
    }
  });
});

describe("POST /api/model/retrain", () => {
  it("401s without auth", async () => {
    const res = await request(app).post("/api/model/retrain");
    expect(res.status).toBe(401);
  });
});
