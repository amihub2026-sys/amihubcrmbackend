import { randomUUID } from "node:crypto";
import { models, transaction, plain } from "../config/database.js";
import { can } from "../middleware/access.js";
import { assert, cents, nextCycle, businessClock } from "../utils/index.js";
import { audit, freshActor } from "./context.service.js";
import { getRecord } from "./query.service.js";
export async function recalculate(invoiceId, session, today) {
  const inv = await models.invoices.findById(invoiceId).session(session).lean();
  const payments = await models.payments
    .find({ invoiceId })
    .session(session)
    .lean();
  const paid = payments.reduce((n, p) => n + cents(p.amount), 0),
    total = cents(inv.totalAmount);
  assert(paid <= total, 422, "Payment exceeds invoice balance");
  const status =
    paid >= total
      ? "PAID"
      : paid
        ? "PARTIALLY_PAID"
        : inv.status === "DRAFT"
          ? "DRAFT"
          : inv.dueDate < today
            ? "OVERDUE"
            : "SENT";
  if (
    inv.paidAmount !== paid / 100 ||
    inv.balanceAmount !== (total - paid) / 100 ||
    inv.status !== status
  )
    await models.invoices.updateOne(
      { _id: invoiceId },
      {
        $set: {
          paidAmount: paid / 100,
          balanceAmount: (total - paid) / 100,
          status,
        },
        $inc: { revision: 1 },
      },
      { session },
    );
  for (const resource of ["installments", "promises"]) {
    const rows = await models[resource]
      .find({ invoiceId })
      .session(session)
      .lean();
    for (const row of rows) {
      const amount = payments
        .filter(
          (p) =>
            p[resource === "installments" ? "installmentId" : "promiseId"] ===
            row._id,
        )
        .reduce((n, p) => n + cents(p.amount), 0);
      assert(
        amount <= cents(row.amount),
        422,
        `Receipt exceeds ${resource} amount`,
      );
      const status =
        resource === "installments"
          ? amount >= cents(row.amount)
            ? "PAID"
            : amount
              ? "PARTIALLY_PAID"
              : row.dueDate < today
                ? "OVERDUE"
                : "PENDING"
          : row.status === "CANCELLED"
            ? "CANCELLED"
            : amount >= cents(row.amount)
              ? "FULFILLED"
              : amount
                ? "PARTIALLY_FULFILLED"
                : row.promisedDate < today
                  ? "BROKEN"
                  : "OPEN";
      if (
        row.paidAmount !== amount / 100 ||
        row.balanceAmount !== (cents(row.amount) - amount) / 100 ||
        row.status !== status
      )
        await models[resource].updateOne(
          { _id: row._id },
          {
            $set: {
              paidAmount: amount / 100,
              balanceAmount: (cents(row.amount) - amount) / 100,
              status,
            },
            $inc: { revision: 1 },
          },
          { session },
        );
    }
  }
}
export async function cycleInvoice(u, id, config, cycleDate) {
  assert(
    can(u, "subscriptions", "update") && can(u, "invoices", "create"),
    403,
    "Access denied",
  );
  assert(
    typeof cycleDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cycleDate),
    422,
    "cycleDate is required for retry-safe billing",
  );
  return transaction(async (session) => {
    u = await freshActor(u, session);
    const sub = await getRecord(u, "subscriptions", id, session);
    const prior = await models.invoices
      .findOne({ subscriptionId: id, cycleDate })
      .session(session)
      .lean();
    if (prior) return plain(prior);
    assert(
      sub.status === "ACTIVE" && sub.nextBillingDate === cycleDate,
      409,
      "Subscription cycle changed or subscription inactive",
    );
    assert(
      cycleDate <= businessClock(config.timezone).date,
      422,
      "This billing cycle is not due yet",
    );
    const due = new Date(cycleDate + "T00:00:00Z");
    due.setUTCDate(due.getUTCDate() + (sub.paymentDueDays || 0));
    const [invoice] = await models.invoices.create(
      [
        {
          invoiceNumber:
            "AMI-" +
            cycleDate.replaceAll("-", "") +
            "-" +
            randomUUID().slice(0, 8).toUpperCase(),
          customerId: sub.customerId,
          subscriptionId: id,
          cycleDate,
          billingPeriod: cycleDate.slice(0, 7),
          description: sub.serviceName,
          items: [
            {
              description: sub.serviceName,
              quantity: 1,
              unitPrice: sub.amount,
            },
          ],
          subtotal: sub.amount,
          tax: 0,
          discount: 0,
          totalAmount: sub.amount,
          paidAmount: 0,
          balanceAmount: sub.amount,
          invoiceDate: cycleDate,
          dueDate: due.toISOString().slice(0, 10),
          status: "SENT",
          createdBy: u._id,
        },
      ],
      { session },
    );
    await models.subscriptions.updateOne(
      { _id: id },
      {
        $set: { nextBillingDate: nextCycle(cycleDate, sub.frequency) },
        $inc: { revision: 1 },
      },
      { session },
    );
    await audit(u, "invoices", invoice, "Created recurring invoice", session);
    return plain(invoice);
  });
}
