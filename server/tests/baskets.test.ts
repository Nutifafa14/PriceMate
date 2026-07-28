import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const app = createApp();

let token: string;
let maizeId: string;
let riceId: string;

function uniqueEmail(): string {
  return `basket-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

beforeAll(async () => {
  const signUp = await request(app)
    .post("/api/auth/sign-up")
    .send({ name: "Basket Tester", email: uniqueEmail(), password: "password123" });
  token = signUp.body.token;

  const commodities = await request(app).get("/api/commodities");
  maizeId = commodities.body.find((c: { name: string }) => c.name === "Maize").id;
  riceId = commodities.body.find((c: { name: string }) => c.name === "Rice (imported)").id;
});

describe("POST /api/baskets/optimize", () => {
  it("is public (no auth required) and returns all three plans plus a recommendation", async () => {
    const res = await request(app)
      .post("/api/baskets/optimize")
      .send({ items: [{ commodityId: maizeId, quantity: 10 }, { commodityId: riceId, quantity: 5 }] });

    expect(res.status).toBe(200);
    expect(res.body.cheapestPerItem).toBeTruthy();
    expect(res.body.cheapestSingleMarket).toBeTruthy();
    expect(res.body.bestCombination).toBeTruthy();
    expect(["singleMarket", "combination", "perItem", "none"]).toContain(res.body.recommendation.plan);
    expect(res.body.transportCostPerExtraMarket).toBe(6);

    // Every plan must actually be net-cost consistent with its own components.
    for (const plan of [res.body.cheapestPerItem, res.body.cheapestSingleMarket, res.body.bestCombination]) {
      expect(plan.netCost).toBeCloseTo(plan.itemTotal + plan.transportCost, 2);
      expect(plan.transportCost).toBe((plan.marketIds.length - 1) * 6);
    }
  });

  it("the best combination's net cost is never worse than the naive per-item total", async () => {
    const res = await request(app)
      .post("/api/baskets/optimize")
      .send({ items: [{ commodityId: maizeId, quantity: 10 }, { commodityId: riceId, quantity: 5 }] });

    expect(res.body.bestCombination.netCost).toBeLessThanOrEqual(res.body.cheapestPerItem.netCost + 0.01);
  });

  it("400s for an empty item list", async () => {
    const res = await request(app).post("/api/baskets/optimize").send({ items: [] });
    expect(res.status).toBe(400);
  });

  it("400s for a malformed commodityId", async () => {
    const res = await request(app)
      .post("/api/baskets/optimize")
      .send({ items: [{ commodityId: "not-a-uuid", quantity: 1 }] });
    expect(res.status).toBe(400);
  });
});

describe("Saved baskets CRUD", () => {
  it("401s without auth", async () => {
    const res = await request(app).get("/api/baskets");
    expect(res.status).toBe(401);
  });

  it("creates, lists, fetches, updates, and deletes a basket", async () => {
    const create = await request(app)
      .post("/api/baskets")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Weekly shop", items: [{ commodityId: maizeId, quantity: 10 }] });
    expect(create.status).toBe(201);
    expect(create.body.items).toHaveLength(1);
    const basketId = create.body.id;

    const list = await request(app).get("/api/baskets").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.some((b: { id: string }) => b.id === basketId)).toBe(true);

    const get = await request(app).get(`/api/baskets/${basketId}`).set("Authorization", `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.name).toBe("Weekly shop");

    const update = await request(app)
      .put(`/api/baskets/${basketId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated shop", items: [{ commodityId: maizeId, quantity: 10 }, { commodityId: riceId, quantity: 5 }] });
    expect(update.status).toBe(200);
    expect(update.body.name).toBe("Updated shop");
    expect(update.body.items).toHaveLength(2);

    const optimize = await request(app)
      .post(`/api/baskets/${basketId}/optimize`)
      .set("Authorization", `Bearer ${token}`);
    expect(optimize.status).toBe(200);
    expect(optimize.body.cheapestSingleMarket).toBeTruthy();

    const del = await request(app).delete(`/api/baskets/${basketId}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const getAfterDelete = await request(app).get(`/api/baskets/${basketId}`).set("Authorization", `Bearer ${token}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it("404s fetching another user's basket", async () => {
    const otherSignUp = await request(app)
      .post("/api/auth/sign-up")
      .send({ name: "Other User", email: uniqueEmail(), password: "password123" });
    const otherToken = otherSignUp.body.token;

    const create = await request(app)
      .post("/api/baskets")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Private list", items: [{ commodityId: maizeId, quantity: 1 }] });

    const res = await request(app)
      .get(`/api/baskets/${create.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });
});
