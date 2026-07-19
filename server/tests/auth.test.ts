import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const app = createApp();

function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe("POST /api/auth/sign-up", () => {
  it("creates a user and returns a token", async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post("/api/auth/sign-up")
      .send({ name: "Ama Owusu", email, password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Ama Owusu", email });
    expect(res.body.user).not.toHaveProperty("password_hash");
    expect(typeof res.body.token).toBe("string");
  });

  it("409s on a duplicate email", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/sign-up").send({ name: "First", email, password: "password123" });
    const res = await request(app)
      .post("/api/auth/sign-up")
      .send({ name: "Second", email, password: "password123" });
    expect(res.status).toBe(409);
  });

  it("400s on a short password", async () => {
    const res = await request(app)
      .post("/api/auth/sign-up")
      .send({ name: "Ama", email: uniqueEmail(), password: "short" });
    expect(res.status).toBe(400);
  });

  it("400s on an invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/sign-up")
      .send({ name: "Ama", email: "not-an-email", password: "password123" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/sign-in", () => {
  it("signs in with correct credentials", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/sign-up").send({ name: "Ama", email, password: "password123" });

    const res = await request(app).post("/api/auth/sign-in").send({ email, password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(typeof res.body.token).toBe("string");
  });

  it("401s on wrong password", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/sign-up").send({ name: "Ama", email, password: "password123" });

    const res = await request(app).post("/api/auth/sign-in").send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("401s on an email that was never registered", async () => {
    const res = await request(app)
      .post("/api/auth/sign-in")
      .send({ email: uniqueEmail(), password: "password123" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid token", async () => {
    const email = uniqueEmail();
    const signUp = await request(app)
      .post("/api/auth/sign-up")
      .send({ name: "Ama", email, password: "password123" });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${signUp.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it("401s with no token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("401s with a garbage token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
