import test from "node:test";
import assert from "node:assert/strict";
import {
  invoiceTotals,
  nextCycle,
  businessClock,
  hashPassword,
  verifyPassword,
} from "../src/utils/index.js";
import { validate } from "../src/validators/resource.validator.js";
import { can, redact } from "../src/middleware/access.js";
test("invoice totals use line items and integer paise", () => {
  assert.deepEqual(
    invoiceTotals({
      items: [{ unitPrice: 0.1, quantity: 3 }],
      subtotal: 999,
      tax: 0.2,
      discount: 0.1,
    }),
    { subtotal: 0.3, totalAmount: 0.4 },
  );
  assert.throws(() => invoiceTotals({ subtotal: 10, discount: 11 }));
  assert.throws(() => invoiceTotals({ subtotal: 1.001 }));
});
test("billing dates clamp month ends and leap years", () => {
  assert.equal(nextCycle("2024-01-31", "Monthly"), "2024-02-29");
  assert.equal(nextCycle("2024-02-29", "Yearly"), "2025-02-28");
  assert.equal(nextCycle("2026-11-30", "Quarterly"), "2027-02-28");
});
test("attendance uses India midnight boundary", () => {
  assert.deepEqual(
    businessClock("Asia/Kolkata", new Date("2026-09-12T18:31:00Z")),
    { date: "2026-09-13", time: "00:01" },
  );
});
test("validation rejects operator injection, protected fields and impossible dates", () => {
  assert.throws(() => validate("customers", { businessName: { $ne: null } }));
  assert.throws(() =>
    validate("customers", { businessName: "Test", createdBy: "attacker" }),
  );
  assert.throws(() =>
    validate("attendance", { employeeId: "e", date: "2026-02-30" }),
  );
  assert.throws(() =>
    validate("users", { name: "A", email: "a@example.com", role: "superuser" }),
  );
});
test("authorization denies finance to developer and redacts project budgets", () => {
  assert.equal(can({ role: "developer" }, "invoices"), false);
  assert.equal(can({ role: "developer" }, "tasks", "update"), true);
  assert.equal(can({ role: "unknown" }, "customers"), false);
  assert.equal(
    redact({ role: "developer" }, "projects", {
      _id: "p",
      budget: 100,
      projectName: "X",
    }).budget,
    undefined,
  );
});
test("password hashes are salted and verified", async () => {
  const hash = await hashPassword("test-password-1234");
  assert.equal(await verifyPassword("test-password-1234", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  assert.notEqual(hash, await hashPassword("test-password-1234"));
});

test("every resource has explicit schema fields matching the frontend contract", async () => {
  const { models, resources } = await import("../src/config/database.js");
  assert.equal(Object.keys(models).length, 29);
  for (const [name, resource] of Object.entries(resources)) {
    for (const field of resource.fields) {
      if (field.key === "initialPassword")
        assert.equal(models[name].schema.path(field.key), undefined);
      else
        assert.ok(models[name].schema.path(field.key), name + "." + field.key);
    }
  }
});
