import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { randomUUID } from "node:crypto";
import {
  connect,
  models,
  Session,
  Audit,
  Event,
} from "../src/config/database.js";
import { hashPassword } from "../src/utils/index.js";
import { createApp } from "../src/app.js";
let mongo, app, owner, developer, otherDeveloper, employee, otherEmployee;
const config = {
  production: false,
  trustProxy: false,
  origins: ["http://localhost:4200"],
  timezone: "Asia/Kolkata",
  sessionHours: 12,
};
async function login(email) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/login")
    .set("Origin", config.origins[0])
    .send({ email, password: "Testing-password-123" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const csrf = res.headers["set-cookie"]
    .find((c) => c.startsWith("XSRF-TOKEN="))
    .split(";")[0]
    .split("=")[1];
  return { agent, csrf };
}
function mutate(client, method, path, body = {}, key) {
  let req = client.agent[method]("/api" + path)
    .set("Origin", config.origins[0])
    .set("X-XSRF-TOKEN", client.csrf);
  if (key) req = req.set("Idempotency-Key", key);
  return req.send(body);
}
async function create(resource, body) {
  const res = await mutate(owner, "post", "/" + resource, body, randomUUID());
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.record;
}
before(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "7.0.24" },
  });
  await connect(mongo.getUri("crm_test"));
  app = createApp(config);
  const passwordHash = await hashPassword("Testing-password-123");
  await models.users.create({
    name: "Owner",
    email: "owner@example.com",
    role: "owner",
    status: "ACTIVE",
    passwordHash,
  });
  employee = await models.employees.create({
    name: "Dev",
    email: "dev@example.com",
    status: "ACTIVE",
  });
  otherEmployee = await models.employees.create({
    name: "Other",
    email: "other@example.com",
    status: "ACTIVE",
  });
  await models.users.create({
    name: "Dev",
    email: "dev@example.com",
    employeeId: employee._id,
    role: "developer",
    status: "ACTIVE",
    passwordHash,
  });
  await models.users.create({
    name: "Other",
    email: "other@example.com",
    employeeId: otherEmployee._id,
    role: "developer",
    status: "ACTIVE",
    passwordHash,
  });
  owner = await login("owner@example.com");
  developer = await login("dev@example.com");
  otherDeveloper = await login("other@example.com");
});
after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
test("login creates attendance once, rejects bad password and requires CSRF", async () => {
  const first = await models.attendance
    .findOne({ employeeId: employee._id })
    .lean();
  assert.ok(first.checkInAt);
  await login("dev@example.com");
  assert.equal(
    await models.attendance.countDocuments({ employeeId: employee._id }),
    1,
  );
  assert.equal(
    (await models.attendance.findById(first._id)).checkInAt.toISOString(),
    first.checkInAt.toISOString(),
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .set("Origin", config.origins[0])
        .send({ email: "dev@example.com", password: "wrong" })
    ).status,
    401,
  );
  assert.equal(
    (await owner.agent.post("/api/customers").send({ businessName: "X" }))
      .status,
    403,
  );
  assert.equal((await request(app).get("/api/customers")).status, 401);
});
test("all frontend resource endpoints have the paginated contract", async () => {
  const boot = await owner.agent.get("/api/bootstrap");
  assert.equal(boot.status, 200);
  assert.equal(boot.body.resources.length, 29);
  for (const resource of boot.body.resources) {
    const res = await owner.agent.get("/api/" + resource);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
    assert.equal(typeof res.body.total, "number");
  }
});
test("assigned access and budget redaction are enforced by server", async () => {
  const customer = await create("customers", { businessName: "Access test" });
  const project = await create("projects", {
    projectName: "Assigned project",
    customerId: customer.id,
    projectManager: employee._id,
    assignedEmployees: [employee._id],
    budget: 15000,
  });
  const task = await create("tasks", {
    title: "Private task",
    projectId: project.id,
    assignedTo: employee._id,
  });
  const own = await developer.agent.get("/api/projects");
  assert.ok(own.body.items.some((r) => r.id === project.id));
  assert.equal(
    own.body.items.find((r) => r.id === project.id).budget,
    undefined,
  );
  const other = await otherDeveloper.agent.get("/api/tasks");
  assert.ok(!other.body.items.some((r) => r.id === task.id));
  assert.equal(
    (
      await mutate(otherDeveloper, "patch", "/tasks/" + task.id, {
        status: "COMPLETED",
        expectedRevision: task.revision,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await mutate(developer, "patch", "/tasks/" + task.id, {
        assignedTo: otherEmployee._id,
        expectedRevision: task.revision,
      })
    ).status,
    403,
  );
  assert.equal((await developer.agent.get("/api/invoices")).status, 403);
});
test("stale updates and linked deletion fail", async () => {
  const customer = await create("customers", { businessName: "Concurrency" });
  const update = await mutate(owner, "patch", "/customers/" + customer.id, {
    businessName: "New",
    expectedRevision: customer.revision,
  });
  assert.equal(update.status, 200);
  assert.equal(
    (
      await mutate(owner, "patch", "/customers/" + customer.id, {
        businessName: "Lost update",
        expectedRevision: customer.revision,
      })
    ).status,
    409,
  );
  await create("projects", {
    projectName: "Linked",
    customerId: customer.id,
    projectManager: employee._id,
  });
  assert.equal(
    (
      await mutate(
        owner,
        "delete",
        "/customers/" +
          customer.id +
          "?revision=" +
          update.body.record.revision,
      )
    ).status,
    409,
  );
});
test("Won lead conversion is exactly once under concurrent requests", async () => {
  const lead = await create("leads", {
    businessName: "Convert",
    status: "WON",
  });
  const results = await Promise.all([
    mutate(owner, "post", "/leads/" + lead.id + "/convert"),
    mutate(owner, "post", "/leads/" + lead.id + "/convert"),
  ]);
  assert.equal(results[0].status, 200);
  assert.equal(results[1].status, 200);
  assert.equal(results[0].body.record.id, results[1].body.record.id);
  assert.equal(
    await models.customers.countDocuments({ sourceLeadId: lead.id }),
    1,
  );
});
test("receipts are idempotent, atomic, linked correctly and cannot overpay", async () => {
  const customer = await create("customers", { businessName: "Billing" });
  const invoice = await create("invoices", {
    invoiceNumber: "TEST-001",
    customerId: customer.id,
    subtotal: 1000,
    tax: 0,
    discount: 0,
    invoiceDate: "2026-01-01",
    dueDate: "2026-01-30",
    status: "SENT",
  });
  const payment = {
    invoiceId: invoice.id,
    amount: 600,
    paymentDate: "2026-01-05",
    paymentMethod: "UPI",
    transactionReference: "REF-001",
  };
  const key = randomUUID();
  const responses = await Promise.all([
    mutate(owner, "post", "/payments", payment, key),
    mutate(owner, "post", "/payments", payment, key),
  ]);
  for (const res of responses)
    assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(responses[0].body.record.id, responses[1].body.record.id);
  assert.equal((await models.invoices.findById(invoice.id)).balanceAmount, 400);
  assert.equal(
    (
      await mutate(
        owner,
        "post",
        "/payments",
        { ...payment, amount: 500 },
        randomUUID(),
      )
    ).status,
    422,
  );
  assert.equal(
    await models.payments.countDocuments({ invoiceId: invoice.id }),
    1,
  );
  assert.ok(
    await Event.exists({
      type: "payment_received",
      recordId: responses[0].body.record.id,
    }),
  );
  assert.equal(
    (
      await mutate(owner, "patch", "/payments/" + responses[0].body.record.id, {
        amount: 1,
        expectedRevision: 1,
      })
    ).status,
    409,
  );
  assert.equal((await mutate(owner, "post", "/payments", payment)).status, 422);
  const updated = await models.invoices.findById(invoice.id);
  assert.equal(
    (
      await mutate(owner, "patch", "/invoices/" + invoice.id, {
        subtotal: 2000,
        expectedRevision: updated.revision,
      })
    ).status,
    409,
  );
});
test("recurring cycle retries do not advance twice or remove unpaid invoices", async () => {
  const customer = await create("customers", { businessName: "Recurring" });
  const sub = await create("subscriptions", {
    serviceName: "Maintenance",
    customerId: customer.id,
    serviceType: "Backend maintenance",
    amount: 2000,
    frequency: "Monthly",
    startDate: "2026-01-01",
    nextBillingDate: "2026-01-31",
    assignedTo: employee._id,
    status: "ACTIVE",
  });
  const path = "/subscriptions/" + sub.id + "/invoice";
  const res = await mutate(owner, "post", path, { cycleDate: "2026-01-31" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const retry = await mutate(owner, "post", path, { cycleDate: "2026-01-31" });
  assert.equal(retry.body.record.id, res.body.record.id);
  assert.equal(
    (await models.subscriptions.findById(sub.id)).nextBillingDate,
    "2026-02-28",
  );
  const next = await mutate(owner, "post", path, { cycleDate: "2026-02-28" });
  assert.equal(next.status, 200);
  assert.equal(
    await models.invoices.countDocuments({ subscriptionId: sub.id }),
    2,
  );
});
test("logout revokes session and audit is retained", async () => {
  const temporary = await login("other@example.com");
  assert.equal((await mutate(temporary, "post", "/auth/logout")).status, 204);
  assert.equal((await temporary.agent.get("/api/auth/me")).status, 401);
  assert.ok((await Audit.countDocuments()) > 0);
});
