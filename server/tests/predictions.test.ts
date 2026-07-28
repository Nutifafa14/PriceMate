import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const app = createApp();

let commodityId: string;
let cowpeasId: string;
let marketId: string;

beforeAll(async () => {
  const commodities = await request(app).get("/api/commodities");
  const markets = await request(app).get("/api/markets");
  commodityId = commodities.body.find((c: { name: string }) => c.name === "Maize").id;
  cowpeasId = commodities.body.find((c: { name: string }) => c.name === "Cowpeas").id;
  marketId = markets.body.find((m: { name: string }) => m.name === "Kumasi").id;
});

describe("GET /api/predictions", () => {
  it("returns an array (possibly empty before any POST)", async () => {
    const res = await request(app).get("/api/predictions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /api/predictions", () => {
  it("calls the real ML API and persists a prediction", async () => {
    const res = await request(app)
      .post("/api/predictions")
      .send({ commodityId, marketId, month: 8, year: 2023 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      commodityId,
      marketId,
      predictionDate: "2023-08-15",
      modelName: "random_forest",
    });
    expect(res.body.predictedPrice).toBeGreaterThan(0);
    expect(res.body.id).toEqual(expect.any(String));
  });

  it("includes the full forecast pipeline output — range, confidence, why, freshness, disclaimer", async () => {
    const res = await request(app)
      .post("/api/predictions")
      .send({ commodityId, marketId, month: 8, year: 2023 });

    expect(res.status).toBe(201);
    expect(res.body.lowEstimate).toBeLessThanOrEqual(res.body.centralEstimate);
    expect(res.body.highEstimate).toBeGreaterThanOrEqual(res.body.centralEstimate);
    expect(["moderate", "low", "very low"]).toContain(res.body.confidenceLabel);
    expect(Array.isArray(res.body.signals)).toBe(true);
    expect(res.body.signals.map((s: { name: string }) => s.name).sort()).toEqual(["fx", "globalBenchmark", "news"]);
    expect(typeof res.body.extrapolationYears).toBe("number");

    const newsSignal = res.body.signals.find((s: { name: string }) => s.name === "news");
    expect(typeof newsSignal.available).toBe("boolean");
    expect(typeof newsSignal.adjustmentPct).toBe("number");
    expect(Math.abs(newsSignal.adjustmentPct)).toBeLessThanOrEqual(8);
    expect(typeof newsSignal.detail).toBe("string");
    expect(Array.isArray(res.body.why)).toBe(true);
    expect(res.body.why.length).toBeGreaterThan(0);
    expect(res.body.dataFreshness).toMatchObject({ modelTrainedThrough: expect.any(String) });
    expect(res.body.disclaimer).toEqual(expect.any(String));
  });

  it("widens the range and never returns higher confidence for a far-future date than a near-term one", async () => {
    const near = await request(app)
      .post("/api/predictions")
      .send({ commodityId, marketId, month: 8, year: 2023 });
    const far = await request(app)
      .post("/api/predictions")
      .send({ commodityId, marketId, month: 8, year: 2031 });

    expect(near.status).toBe(201);
    expect(far.status).toBe(201);

    const nearWidth = near.body.highEstimate - near.body.lowEstimate;
    const farWidth = far.body.highEstimate - far.body.lowEstimate;
    expect(far.body.extrapolationYears).toBeGreaterThan(near.body.extrapolationYears);
    expect(farWidth).toBeGreaterThan(nearWidth);

    const rank = { moderate: 2, low: 1, "very low": 0 };
    expect(rank[far.body.confidenceLabel as keyof typeof rank]).toBeLessThanOrEqual(
      rank[near.body.confidenceLabel as keyof typeof rank],
    );
  });

  it("marks the global-benchmark signal not applicable for a commodity with no real benchmark", async () => {
    const commodities = await request(app).get("/api/commodities");
    const cassavaId = commodities.body.find((c: { name: string }) => c.name === "Cassava").id;

    const res = await request(app)
      .post("/api/predictions")
      .send({ commodityId: cassavaId, marketId, month: 8, year: 2023 });

    expect(res.status).toBe(201);
    const benchmarkSignal = res.body.signals.find((s: { name: string }) => s.name === "globalBenchmark");
    expect(benchmarkSignal.available).toBe(false);
  });

  it("shows up in a subsequent GET filtered by commodityId", async () => {
    await request(app).post("/api/predictions").send({ commodityId, marketId, month: 9, year: 2023 });
    const res = await request(app).get("/api/predictions").query({ commodityId });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((p: { commodityId: string }) => p.commodityId === commodityId)).toBe(true);
  });

  it("422s for Cowpeas — no Wholesale training data for it", async () => {
    const res = await request(app)
      .post("/api/predictions")
      .send({ commodityId: cowpeasId, marketId, month: 8, year: 2023 });
    expect(res.status).toBe(422);
  });

  it("404s for a well-formed but nonexistent commodityId", async () => {
    const res = await request(app)
      .post("/api/predictions")
      .send({ commodityId: "00000000-0000-0000-0000-000000000000", marketId, month: 8, year: 2023 });
    expect(res.status).toBe(404);
  });

  it("404s for a well-formed but nonexistent marketId", async () => {
    const res = await request(app)
      .post("/api/predictions")
      .send({ commodityId, marketId: "00000000-0000-0000-0000-000000000000", month: 8, year: 2023 });
    expect(res.status).toBe(404);
  });

  it("400s for an out-of-range month", async () => {
    const res = await request(app)
      .post("/api/predictions")
      .send({ commodityId, marketId, month: 13, year: 2023 });
    expect(res.status).toBe(400);
  });

  it("400s for a malformed commodityId", async () => {
    const res = await request(app)
      .post("/api/predictions")
      .send({ commodityId: "not-a-uuid", marketId, month: 8, year: 2023 });
    expect(res.status).toBe(400);
  });
});
