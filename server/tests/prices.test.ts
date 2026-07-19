import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const app = createApp();

let sampleCommodityId: string;
let sampleMarketId: string;

beforeAll(async () => {
  const commodities = await request(app).get("/api/commodities");
  const markets = await request(app).get("/api/markets");
  sampleCommodityId = commodities.body[0].id;
  sampleMarketId = markets.body[0].id;
});

describe("GET /api/prices", () => {
  it("returns a page of prices, defaulting to limit 100", async () => {
    const res = await request(app).get("/api/prices");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(100);
    expect(res.body[0]).toMatchObject({
      commodityId: expect.any(String),
      marketId: expect.any(String),
      priceType: expect.stringMatching(/^(Wholesale|Retail)$/),
    });
  });

  it("respects limit and offset", async () => {
    const page1 = await request(app).get("/api/prices").query({ limit: 5, offset: 0 });
    const page2 = await request(app).get("/api/prices").query({ limit: 5, offset: 5 });
    expect(page1.body).toHaveLength(5);
    expect(page2.body).toHaveLength(5);
    expect(page1.body.map((p: { id: string }) => p.id)).not.toEqual(
      page2.body.map((p: { id: string }) => p.id),
    );
  });

  it("filters by commodityId", async () => {
    const res = await request(app).get("/api/prices").query({ commodityId: sampleCommodityId, limit: 500 });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((p: { commodityId: string }) => p.commodityId === sampleCommodityId)).toBe(true);
  });

  it("filters by marketId and priceType together", async () => {
    const res = await request(app)
      .get("/api/prices")
      .query({ marketId: sampleMarketId, priceType: "Wholesale", limit: 500 });
    expect(res.status).toBe(200);
    expect(
      res.body.every(
        (p: { marketId: string; priceType: string }) =>
          p.marketId === sampleMarketId && p.priceType === "Wholesale",
      ),
    ).toBe(true);
  });

  it("filters by date range", async () => {
    const res = await request(app)
      .get("/api/prices")
      .query({ from: "2015-01-01", to: "2015-12-31", limit: 500 });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const p of res.body) {
      expect(p.date >= "2015-01-01" && p.date <= "2015-12-31").toBe(true);
    }
  });

  it("400s for an invalid priceType", async () => {
    const res = await request(app).get("/api/prices").query({ priceType: "Bulk" });
    expect(res.status).toBe(400);
  });

  it("400s for a limit above the max", async () => {
    const res = await request(app).get("/api/prices").query({ limit: 5000 });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/prices/latest", () => {
  it("returns at most one row per commodity/market/priceType combination", async () => {
    const res = await request(app).get("/api/prices/latest");
    expect(res.status).toBe(200);
    const keys = res.body.map((p: { commodityId: string; marketId: string; priceType: string }) =>
      [p.commodityId, p.marketId, p.priceType].join("|"),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("filters down to a single commodity+market pair", async () => {
    const res = await request(app)
      .get("/api/prices/latest")
      .query({ commodityId: sampleCommodityId, marketId: sampleMarketId });
    expect(res.status).toBe(200);
    for (const p of res.body) {
      expect(p.commodityId).toBe(sampleCommodityId);
      expect(p.marketId).toBe(sampleMarketId);
    }
  });
});
