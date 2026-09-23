import { randomUUID } from "node:crypto";
import {
  models,
  resources,
  Event,
  Session,
  Idempotency,
  transaction,
} from "../config/database.js";
import { can, scope, scoped, redact } from "../middleware/access.js";
import { validate, references } from "../validators/resource.validator.js";
import {
  assert,
  cents,
  hashPassword,
  digest,
  businessClock,
} from "../utils/index.js";
import { getRecord } from "./query.service.js";
import { audit, freshActor } from "./context.service.js";
import { recalculate } from "./billing.service.js";
export { audit } from "./context.service.js";
export { convert } from "./lead-conversion.service.js";
export { cycleInvoice, recalculate } from "./billing.service.js";
function matches(record, query) {
  return Object.entries(query).every(([k, v]) =>
    k === "$or"
      ? v.some((q) => matches(record, q))
      : v && v.$in
        ? (Array.isArray(record[k]) ? record[k] : [record[k]]).some((x) =>
            v.$in.includes(x),
          )
        : record[k] === v,
  );
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function visible(u, r, record, session) {
  return matches(record, await scope(u, r, session));
}
export async function list(u, r, page = 1, pageSize = 200) {
  assert(can(u, r), 403, "Access denied");
  const filter = await scope(u, r);
  const [items, total] = await Promise.all([
    models[r]
      .find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    models[r].countDocuments(filter),
  ]);
  return { items: items.map((x) => redact(u, r, x)), page, pageSize, total };
}
async function links(u, r, record, session) {
  const linked = {};
  for (const f of resources[r].fields) {
    const target = references[f.type],
      value = record[f.key];
    if (!target || !value) continue;
    for (const id of Array.isArray(value) ? value : [value]) {
      const row = await models[target].findById(id).session(session).lean();
      assert(row, 422, `Invalid reference: ${f.key}`);
      // Directory-only employee references are allowed; other scoped links must be visible.
      if (scoped.has(u.role) && target !== "employees")
        assert(
          await visible(u, target, row, session),
          403,
          `Reference outside assigned work: ${f.key}`,
        );
      linked[f.key] = row;
    }
  }
  for (const k of [
    "projectId",
    "invoiceId",
    "marketingPlanId",
    "campaignId",
    "subscriptionId",
    "visitId",
  ])
    if (record.customerId && linked[k]?.customerId)
      assert(
        linked[k].customerId === record.customerId,
        422,
        `${k} belongs to another customer`,
      );
  if (linked.installmentId)
    assert(
      linked.installmentId.invoiceId === record.invoiceId,
      422,
      "Installment belongs to another invoice",
    );
  if (linked.promiseId)
    assert(
      linked.promiseId.invoiceId === record.invoiceId,
      422,
      "Promise belongs to another invoice",
    );
  if (linked.visitId && linked.invoiceId)
    assert(
      linked.visitId.customerId === linked.invoiceId.customerId,
      422,
      "Visit belongs to another customer",
    );
  return linked;
}
export async function save(u, r, body, id, config, idempotencyKey) {
  assert(can(u, r, id ? "update" : "create"), 403, "Access denied");
  let passwordHash;
  if (r === "users" && body.initialPassword)
    passwordHash = await hashPassword(body.initialPassword);
  return transaction(async (session) => {
    u = await freshActor(u, session);
    assert(can(u, r, id ? "update" : "create"), 403, "Access denied");
    let idem;
    if (idempotencyKey) {
      assert(
        typeof idempotencyKey === "string" &&
          /^[\w-]{16,100}$/.test(idempotencyKey),
        422,
        "Invalid Idempotency-Key",
      );
      idem = digest(
        u._id + ":" + r + ":" + (id || "create") + ":" + idempotencyKey,
      );
      const prior = await Idempotency.findById(idem).session(session).lean();
      if (prior) {
        assert(
          prior.fingerprint === digest(JSON.stringify(body)),
          409,
          "Idempotency key reused with different data",
        );
        return prior.response;
      }
    }
    assert(
      r !== "payments" || id || idem,
      422,
      "Payment creation requires Idempotency-Key",
    );
    const existing = id ? await getRecord(u, r, id, session) : null;
    if (existing)
      assert(
        Number.isInteger(body.expectedRevision) &&
          body.expectedRevision === existing.revision,
        409,
        "Record changed. Reload and retry.",
      );
    assert(
      !(r === "payments" && id),
      409,
      "Receipts are immutable; use a reviewed accounting correction process",
    );
let record = validate(r, body, existing);

if (r === "leave" && record.startDate && record.endDate) {
  const start = new Date(record.startDate + "T00:00:00Z");
  const end = new Date(record.endDate + "T00:00:00Z");

  const totalDays =
    Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

  assert(totalDays > 0, 422, "Invalid leave dates");

  record.totalDays = totalDays;
}

if (
  r === "leave" &&
  !["owner", "admin", "hr"].includes(u.role)
) {
  assert(
    u.employeeId,
    403,
    "Employee account is not linked"
  );

  assert(
    !existing,
    403,
    "Employees cannot update leave requests"
  );

  record.employeeId = u.employeeId;
  record.status = "PENDING";
}
    if (
      ["developer", "designer", "video_editor", "telecaller"].includes(u.role)
    ) {
      for (const key of [
        "assignedTo",
        "assignedEmployees",
        "projectManager",
        "employeeId",
        "accountManager",
      ])
        if (body[key] !== undefined)
          assert(
            JSON.stringify(record[key]) === JSON.stringify(existing?.[key]) ||
              (!existing && record[key] === u.employeeId),
            403,
            "Assignment changes are not permitted",
          );
      if (
        existing &&
        ["projectId", "leadId", "marketingPlanId", "customerId"].some(
          (k) => body[k] !== undefined && record[k] !== existing[k],
        )
      )
        assert(false, 403, "Cannot move assigned work");
    }
    if (existing && r === "users") {
      assert(
        existing.role !== "owner" || u.role === "owner",
        403,
        "Only Owner may manage Owner accounts",
      );
      assert(
        existing._id !== u._id ||
          (record.status === "ACTIVE" && record.role === existing.role),
        409,
        "Cannot disable or change your own role",
      );
      if (
        existing.role === "owner" &&
        (record.role !== "owner" || record.status !== "ACTIVE")
      )
        assert(
          (await models.users
            .countDocuments({ role: "owner", status: "ACTIVE" })
            .session(session)) > 1,
          409,
          "At least one active Owner is required",
        );
    }
    if (r === "users") {
      assert(
        record.role !== "owner" || u.role === "owner",
        403,
        "Only Owner may create an Owner",
      );
      assert(existing || passwordHash, 422, "Initial password is required");
      if (!["owner", "admin"].includes(record.role))
        assert(
          record.employeeId,
          422,
          "Employee link required for staff accounts",
        );
      if (passwordHash) record.passwordHash = passwordHash;
      delete record.initialPassword;
      record.authVersion = (existing?.authVersion || 0) + 1;
      if (existing) await Session.deleteMany({ userId: id }).session(session);
    }
    if (existing)
      for (const f of resources[r].fields) {
        if (
          references[f.type] &&
          !["employee", "employee-list"].includes(f.type) &&
          body[f.key] !== undefined
        )
          assert(
            record[f.key] === existing[f.key],
            409,
            `Linked record cannot be changed: ${f.key}`,
          );
      }
    if (r === "invoices" && existing?.status !== "DRAFT" && existing)
      assert(
        record.status !== "DRAFT",
        409,
        "Issued invoice cannot return to Draft",
      );
    const linked = await links(u, r, record, session);
    if (r === "payroll" && (!existing || existing.status === "CALCULATED")) {
  const employee = linked.employeeId;

  assert(employee, 422, "Employee is required");
  const grossSalary = Number(employee.monthlySalary || 0);
const workingDays = Number(employee.salaryWorkingDays || 26);
const allowedCasualLeaveDays = Number(employee.allowedCasualLeavePerMonth ?? 1);
assert(grossSalary > 0, 422, "Employee monthly salary is not configured");
assert(workingDays > 0, 422, "Employee salary working days is invalid");
const monthValue = String(record.month || "");
assert(
  /^\d{4}-\d{2}$/.test(monthValue),
  422,
  "Salary month must be in YYYY-MM format",
);
const [selectedYear, selectedMonth] = monthValue.split("-").map(Number);
assert(
  selectedYear === Number(record.year),
  422,
  "Salary month and year do not match",
);
const monthStart = `${monthValue}-01`;
const lastDay = new Date(
  Date.UTC(selectedYear, selectedMonth, 0),
).toISOString().slice(0, 10);
const attendanceRows = await models.attendance
  .find({
    employeeId: record.employeeId,
    date: {
      $gte: monthStart,
      $lte: lastDay,
    },
  })
  .session(session)
  .lean();
  const presentDays = attendanceRows.filter(
  (x) => x.status === "PRESENT" || x.status === "REMOTE",
).length;
const halfDays = attendanceRows.filter(
  (x) => x.status === "HALF_DAY",
).length;
const absentDays = attendanceRows.filter(
  (x) => x.status === "ABSENT",
).length;
const approvedLeaves = await models.leave
  .find({
    employeeId: record.employeeId,
    status: "APPROVED",
    startDate: { $lte: lastDay },
endDate: { $gte: monthStart },
  })
  .session(session)
  .lean();
  let casualLeaveDays = 0;
  const casualLeaves = approvedLeaves.filter(
  (leave) => String(leave.leaveType || "").toUpperCase().includes("CASUAL"),
);
casualLeaveDays = casualLeaves.reduce(
  (total, leave) => total + Number(leave.totalDays || 0),
  0,
);
const unpaidLeaves = approvedLeaves.filter(
  (leave) => String(leave.leaveType || "").toUpperCase().includes("UNPAID"),
);

const unpaidLeaveDays = unpaidLeaves.reduce(
  (total, leave) => total + Number(leave.totalDays || 0),
  0,
);
const extraLeaveDays = Math.max(
  0,
  casualLeaveDays - allowedCasualLeaveDays,
);
const perDaySalary = roundMoney(grossSalary / workingDays);

const totalDeductionDays =
  absentDays + unpaidLeaveDays + extraLeaveDays;

const leaveDeduction = roundMoney(
  totalDeductionDays * perDaySalary
);
const otherDeduction = Number(record.otherDeduction || 0);
const bonus = Number(record.bonus || 0);
const allowance = Number(record.allowance || 0);
const netSalary = roundMoney(
  grossSalary - leaveDeduction - otherDeduction + bonus + allowance
);
  record.grossSalary = grossSalary;
  record.workingDays = workingDays;
record.presentDays = presentDays;
record.absentDays = absentDays;
record.halfDays = halfDays;
record.casualLeaveDays = casualLeaveDays;
  record.allowedCasualLeaveDays = allowedCasualLeaveDays;
  record.extraLeaveDays = extraLeaveDays;
  record.unpaidLeaveDays = unpaidLeaveDays;
  record.perDaySalary = roundMoney(perDaySalary);
  record.leaveDeduction = roundMoney(leaveDeduction);
  record.otherDeduction = otherDeduction;
  record.bonus = bonus;
  record.allowance = allowance;
  record.netSalary = netSalary;
  if (!existing) record.status = "CALCULATED";
}
if (r === "payroll" && existing) {
  const allowedTransitions = {
    CALCULATED: ["APPROVED"],
    APPROVED: ["PAID"],
    PAID: [],
  };

  assert(
    existing.status === record.status ||
      allowedTransitions[existing.status]?.includes(record.status),
    409,
    "Invalid payroll status change",
  );
}
if (r === "payroll" && existing && existing.status !== "CALCULATED") {
  const lockedFields = [
    "employeeId",
    "month",
    "year",
    "grossSalary",
    "workingDays",
   "presentDays",
"absentDays",
"casualLeaveDays",
    "allowedCasualLeaveDays",
    "extraLeaveDays",
    "unpaidLeaveDays",
    "halfDays",
    "perDaySalary",
    "leaveDeduction",
    "otherDeduction",
    "bonus",
    "allowance",
    "netSalary",
  ];

  for (const key of lockedFields) {
    assert(
      JSON.stringify(record[key]) === JSON.stringify(existing[key]),
      409,
      "Approved payroll financial details cannot be changed",
    );
  }
}
if (r === "payroll" && record.status === "PAID") {
  assert(record.paymentDate, 422, "Payment date is required");
  assert(record.paymentMethod, 422, "Payment method is required");
}
    if (r === "users" && linked.employeeId)
      assert(
        linked.employeeId.status !== "INACTIVE",
        422,
        "Cannot link an inactive employee",
      );
    if (r === "attendance" && existing?.source === "LOGIN") {
      assert(
        record.date === existing.date &&
          record.employeeId === existing.employeeId,
        409,
        "Automatic attendance identity is immutable",
      );
    }
    if (existing && ["invoices", "installments", "promises"].includes(r)) {
      if (r === "invoices") {
        assert(
          record.customerId === existing.customerId,
          409,
          "Invoice customer is immutable",
        );
        const count = await models.payments
          .countDocuments({ invoiceId: id })
          .session(session);
        if (count || existing.status !== "DRAFT")
          for (const key of [
            "subtotal",
            "tax",
            "discount",
            "items",
            "invoiceNumber",
            "invoiceDate",
            "projectId",
            "subscriptionId",
            "billingPeriod",
          ])
            assert(
              JSON.stringify(record[key]) === JSON.stringify(existing[key]),
              409,
              "Issued invoice financial details are immutable",
            );
      } else
        assert(
          record.invoiceId === existing.invoiceId,
          409,
          "Invoice link is immutable",
        );
    }
    if (r === "renewals" && record.status === "RENEWED")
      assert(
        existing && record.expiryDate > existing.expiryDate,
        422,
        "Renewal completion requires a later verified expiry date",
      );
    if (r === "promises" && existing && existing.status === "CANCELLED")
      assert(
        record.status === "CANCELLED",
        409,
        "Cancelled promises remain cancelled",
      );
    if (r === "subscriptions" && existing)
      assert(
        record.customerId === existing.customerId,
        409,
        "Subscription customer is immutable",
      );
    if (r === "installments") {
      const others = await models.installments
        .find({
          invoiceId: record.invoiceId,
          ...(id ? { _id: { $ne: id } } : {}),
        })
        .session(session)
        .lean();
      assert(
        others.reduce((n, x) => n + cents(x.amount), cents(record.amount)) <=
          cents(linked.invoiceId.totalAmount),
        422,
        "Installments exceed invoice total",
      );
    }
    if (r === "payments") {
      assert(
        linked.invoiceId.status !== "DRAFT",
        422,
        "Issue the invoice before receiving payment",
      );
      assert(
        linked.promiseId?.status !== "CANCELLED",
        422,
        "Promise was cancelled",
      );
    }
    record._id = id || randomUUID();
    record.revision = (existing?.revision || 0) + 1;
    record.createdBy = existing?.createdBy || u._id;
    assert(
      await visible(u, r, record, session),
      403,
      "Record must be within your assigned work",
    );
    if (existing) {
      const set = { ...record };
      delete set._id;
      delete set.createdAt;
      delete set.updatedAt;
      const unset = {};
      for (const [k, v] of Object.entries(set))
        if (v === undefined) {
          unset[k] = 1;
          delete set[k];
        }
      await models[r].updateOne(
        { _id: id, revision: existing.revision },
        { $set: set, $unset: unset },
        { session, runValidators: true },
      );
    } else await models[r].create([record], { session });
    if (r === "employees" && record.status === "INACTIVE") {
      const users = await models.users
        .find({ employeeId: record._id })
        .session(session)
        .lean();
      assert(
        !users.some((x) => x.role === "owner"),
        409,
        "Reassign Owner before deactivating employee",
      );
      await models.users.updateMany(
        { employeeId: record._id },
        { $set: { status: "INACTIVE" }, $inc: { authVersion: 1 } },
        { session },
      );
      await Session.deleteMany({
        userId: { $in: users.map((x) => x._id) },
      }).session(session);
    }
    if (
      r === "calls" &&
      record.nextFollowUpDate &&
      record.nextFollowUpDate !== existing?.nextFollowUpDate
    ) {
      const followup = {
        leadId: record.leadId,
        assignedTo: record.employeeId,
        followUpDate: record.nextFollowUpDate,
        notes: record.notes,
        status: "PENDING",
        createdBy: u._id,
      };
      const [created] = await models.followups.create([followup], { session });
      await audit(u, "followups", created, "Created from call", session);
    }
    const today = businessClock(config.timezone).date;
    if (["invoices", "installments", "promises", "payments"].includes(r))
      await recalculate(
        r === "invoices" ? record._id : record.invoiceId,
        session,
        today,
      );
    await audit(u, r, record, existing ? "Updated" : "Created", session);
    if (
  r === "leave" &&
  existing &&
  existing.status !== "APPROVED" &&
  record.status === "APPROVED"
) {
  const start = new Date(record.startDate + "T00:00:00Z");
  const end = new Date(record.endDate + "T00:00:00Z");

  for (
    let date = new Date(start);
    date <= end;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const leaveDate = date.toISOString().slice(0, 10);

const attendance = await models.attendance
  .findOne({
    employeeId: record.employeeId,
    date: leaveDate,
  })
  .session(session)
  .lean();

if (!attendance) {
  await models.attendance.create(
    [
      {
        employeeId: record.employeeId,
        date: leaveDate,
        status: "LEAVE",
        source: "APPROVED_LEAVE",
        createdBy: u._id,
      },
    ],
    { session },
  );
} else if (
  attendance.status === "ABSENT" &&
  attendance.source === "AUTO_ABSENT"
) {
  await models.attendance.updateOne(
    { _id: attendance._id },
    {
      $set: {
        status: "LEAVE",
        source: "APPROVED_LEAVE",
      },
      $inc: { revision: 1 },
    },
    { session },
  );
}
  }
}
    if (
  r === "payroll" &&
  existing?.status === "APPROVED" &&
  record.status === "PAID"
) {
  const employeeUser = await models.users
    .findOne({
      employeeId: record.employeeId,
      status: "ACTIVE",
    })
    .session(session)
    .lean();

  if (employeeUser) {
  await Event.create(
    [
      {
        recipientId: employeeUser._id,
        type: "salary_paid",
        recordId: record._id,
        message: `Salary paid: INR ${record.netSalary}`,
      },
    ],
    { session },
  );

 await models.payroll.updateOne(
  { _id: record._id },
  { $set: { notificationSent: true } },
  { session },
);

record.notificationSent = true;
}
}
    if (r === "payments") {
      const recipients = await models.users
        .find({
          role: { $in: ["owner", "admin", "accounts"] },
          status: "ACTIVE",
        })
        .session(session)
        .lean();
      for (const recipient of recipients)
        await Event.create(
          [
            {
              recipientId: recipient._id,
              type: "payment_received",
              recordId: record._id,
              message: `Payment received: INR ${record.amount}`,
            },
          ],
          { session },
        );
    }
    const result = redact(
      u,
      r,
      await models[r].findById(record._id).session(session).lean(),
    );
    if (idem)
      await Idempotency.create(
        [
          {
            _id: idem,
            fingerprint: digest(JSON.stringify(body)),
            response: result,
          },
        ],
        { session },
      );
    return result;
  });
}
export async function remove(u, r, id, revision) {
  assert(can(u, r, "delete"), 403, "Access denied");
  assert(
    ![
      "users",
      "employees",
      "attendance",
      "payroll",
      "invoices",
      "payments",
      "installments",
      "expenses",
      "quotations",
      "promises",
      "subscriptions",
      "billingProfile",
    ].includes(r),
    409,
    "Retained record: update its status instead of deleting",
  );
  return transaction(async (session) => {
    u = await freshActor(u, session);
    const row = await getRecord(u, r, id, session);
    assert(row.revision === revision, 409, "Record changed. Reload and retry.");
    for (const [key, tab] of Object.entries(resources))
      for (const f of tab.fields)
        if (references[f.type] === r)
          assert(
            !(await models[key].exists({ [f.key]: id }).session(session)),
            409,
            `Referenced by ${key}; cannot delete`,
          );
    if (r === "leads")
      assert(
        !(await models.customers.exists({ sourceLeadId: id }).session(session)),
        409,
        "Converted leads are retained",
      );
    await models[r].deleteOne({ _id: id }).session(session);
    await audit(u, r, row, "Deleted", session);
  });
}
