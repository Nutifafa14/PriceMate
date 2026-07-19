import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const app = createApp();

let makolaMarketId: string;
let sampleCommodityId: string;

beforeAll(async () => {
  const markets = await request(app).get("/api/markets");
  const makola = markets.body.find((m: { name: string }) => m.name === "Makola");
  makolaMarketId = makola.id;

  const commodities = await request(app).get("/api/commodities");
  sampleCommodityId = commodities.body[0].id;
});

describe("GET /api/community-prices", () => {
  it("returns a page of community prices with a source label", async () => {
    const res = await request(app).get("/api/community-prices").query({ limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      commodityId: expect.any(String),
      marketId: expect.any(String),
      priceType: expect.stringMatching(/^(Wholesale|Retail)$/),
      source: "MoFA SRID",
    });
  });

  it("filters by marketId, returning only rows for a new named market not in the WFP-derived data", async () => {
    const res = await request(app)
      .get("/api/community-prices")
      .query({ marketId: makolaMarketId, limit: 500 });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((p: { marketId: string }) => p.marketId === makolaMarketId)).toBe(true);
  });

  it("returns no wholesale-trend prices for a MoFA-only market (it has no WFP price history)", async () => {
    const res = await request(app).get("/api/prices").query({ marketId: makolaMarketId, limit: 500 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("filters by commodityId", async () => {
    const res = await request(app)
      .get("/api/community-prices")
      .query({ commodityId: sampleCommodityId, limit: 500 });
    expect(res.status).toBe(200);
    expect(res.body.every((p: { commodityId: string }) => p.commodityId === sampleCommodityId)).toBe(true);
  });

  it("400s for an invalid priceType", async () => {
    const res = await request(app).get("/api/community-prices").query({ priceType: "Bulk" });
    expect(res.status).toBe(400);
  });
});
