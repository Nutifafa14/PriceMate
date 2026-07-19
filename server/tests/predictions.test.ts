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
