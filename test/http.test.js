import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Rate, Session, models } from "../src/config/database.js";
const config = {
  production: false,
  trustProxy: false,
  origins: ["http://localhost:4200"],
  sessionHours: 12,
  timezone: "Asia/Kolkata",
};
const app = createApp(config);
function limits(t) {
  t.mock.method(Rate, "findOneAndUpdate", async () => ({ count: 1 }));
}
function identity(t, role = "owner") {
  limits(t);
  t.mock.method(Session, "findOne", () => ({
    lean: async () => ({ userId: "user-1", authVersion: 1, csrf: "test-csrf" }),
  }));
  t.mock.method(models.users, "findOne", () => ({
    lean: async () => ({
      _id: "user-1",
      name: "Test",
      role,
      authVersion: 1,
      status: "ACTIVE",
    }),
  }));
}
const sessionCookie = "crm_session=" + "a".repeat(64);
test("health route responds without authentication or database", async () => {
  const response = await request(app).get("/api/health/live");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});
test("login remains public but rejects untrusted origin before credential lookup", async (t) => {
  limits(t);
  const response = await request(app)
    .post("/api/auth/login")
    .set("Origin", "https://untrusted.example")
    .send({ email: "x@y.com", password: "Password-12345" });
  assert.equal(response.status, 403);
  assert.match(response.body.message, /Origin/);
});
test("resource routes require an authenticated session", async (t) => {
  limits(t);
  assert.equal((await request(app).get("/api/leads")).status, 401);
});
test("every feature list route delegates and returns the paginated contract (mocked database)", async (t) => {
  identity(t);
  for (const [name, model] of Object.entries(models)) {
    t.mock.method(model, "find", () => ({
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      lean: async () => [],
    }));
    t.mock.method(model, "countDocuments", async () => 0);
    const response = await request(app)
      .get("/api/" + name)
      .set("Cookie", sessionCookie);
    assert.equal(
      response.status,
      200,
      name + ": " + JSON.stringify(response.body),
    );
    assert.deepEqual(response.body, {
      items: [],
      page: 1,
      pageSize: 200,
      total: 0,
    });
  }
});
test("developer cannot read finance and authenticated writes require CSRF", async (t) => {
  identity(t, "developer");
  assert.equal(
    (await request(app).get("/api/invoices").set("Cookie", sessionCookie))
      .status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .patch("/api/tasks/task-1")
        .set("Cookie", sessionCookie)
        .set("Origin", config.origins[0])
        .send({ status: "COMPLETED", expectedRevision: 1 })
    ).status,
    403,
  );
});
