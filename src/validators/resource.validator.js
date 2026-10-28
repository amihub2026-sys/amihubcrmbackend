
import { resources } from "../config/database.js";
import { roles } from "../middleware/access.js";
import { assert, cents, invoiceTotals } from "../utils/index.js";

export const references = {
  employee: "employees",
  "employee-list": "employees",
  customer: "customers",
  project: "projects",
  lead: "leads",
  invoice: "invoices",
  installment: "installments",
  plan: "plans",
  campaign: "campaigns",
  subscription: "subscriptions",
  visit: "visits",
  promise: "promises",
};

const required = {
  users: ["name", "email", "role"],
  leads: ["businessName"],
  customers: ["businessName"],
  projects: ["projectName", "customerId", "projectManager"],

  // Project tasks and Digital Marketing tasks
  tasks: ["title", "assignedTo"],

  files: ["title", "projectId", "fileUrl"],
  calls: ["leadId", "employeeId", "callDate"],
  followups: ["leadId", "assignedTo", "followUpDate"],
  meetings: ["title", "leadId", "date"],
  quotations: ["quotationNumber", "leadId"],
  employees: ["name", "email"],
  attendance: ["employeeId", "date"],
  leave: ["employeeId", "startDate", "endDate", "reason"],
invoices: ["invoiceNumber", "invoiceDate", "dueDate"],
  installments: ["invoiceId", "amount", "dueDate"],
  payments: ["invoiceId", "amount", "paymentDate", "paymentMethod"],
  expenses: ["description", "amount", "expenseDate"],

  plans: [
    "customerId",
    "digitalMarketingPlanId",
    "month",
    "planStartDate",
  ],

  content: ["title", "marketingPlanId", "customerId"],

  tickets: ["title", "customerId", "assignedTo"],
  renewals: ["serviceName", "customerId", "expiryDate", "assignedTo"],
  services: ["name"],
  departments: ["name"],
};

const money = new Set([
  "amount",
  "subtotal",
  "tax",
  "discount",
  "budget",
  "actualSpend",
]);

export function validate(r, body, existing = null) {
  assert(
    body && typeof body === "object" && !Array.isArray(body),
    422,
    "Expected a JSON object",
  );

  const tab = resources[r];

  const allowed = new Set([
    ...tab.fields.map((f) => f.key),
    "status",
    "expectedRevision",
    ...(["invoices", "quotations"].includes(r) ? ["items"] : []),
  ]);

  // =====================================================
  // REJECT UNKNOWN OR PROTECTED FIELDS
  // =====================================================

  for (const key of Object.keys(body)) {
    assert(
      allowed.has(key),
      422,
      `Unknown or protected field: ${key}`,
    );
  }

  const patch = {};

  // =====================================================
  // FIELD VALIDATION
  // =====================================================

  for (const f of tab.fields) {
    if (!(f.key in body)) continue;

    let v = body[f.key];

    if (v === null || v === "") {
      patch[f.key] = undefined;
      continue;
    }

    // ===================================================
    // NUMBER
    // ===================================================

    if (f.type === "number") {
      if (typeof v === "string" && v.trim() !== "") {
        v = Number(v);
      }

      assert(
        typeof v === "number" &&
          Number.isFinite(v) &&
          v >= 0 &&
          v <= 1e10,
        422,
        `Invalid ${f.key}`,
      );

      if (money.has(f.key)) {
        cents(v);
      }

      if (f.key === "progress") {
        assert(
          v <= 100,
          422,
          "Progress cannot exceed 100",
        );
      }

      if (
        [
          "posterTarget",
          "reelTarget",
          "storyTarget",
          "videoTarget",
          "leadCount",
          "conversions",
          "paymentDueDays",
        ].includes(f.key)
      ) {
        assert(
          Number.isInteger(v),
          422,
          `${f.key} must be an integer`,
        );
      }

      if (f.key === "paymentDueDays") {
        assert(
          v <= 365,
          422,
          "Payment due days must be within 365",
        );
      }

    // ===================================================
    // EMPLOYEE LIST
    // ===================================================

    } else if (f.type === "employee-list") {
      if (typeof v === "string") {
        v = v
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      }

      assert(
        Array.isArray(v) &&
          v.length <= 100 &&
          v.every(
            (x) =>
              typeof x === "string" &&
              x.length <= 100,
          ),
        422,
        "Invalid employee list",
      );

      v = [...new Set(v)];

    // ===================================================
    // NUMBER LIST
    // ===================================================

    } else if (f.type === "number-list") {
      if (typeof v === "string") {
        v = v
          .split(",")
          .map((x) => Number(x.trim()));
      }

      assert(
        Array.isArray(v) &&
          v.length > 0 &&
          v.length <= 7 &&
          v.every(
            (x) =>
              Number.isInteger(x) &&
              x >= 0 &&
              x <= 6,
          ),
        422,
        `Invalid ${f.key}`,
      );

      v = [...new Set(v)];

    // ===================================================
    // STRING / TEXT / DATE / SELECT / URL
    // ===================================================

    } else {
      assert(
        typeof v === "string" &&
          v.length <=
            (f.type === "textarea"
              ? 10000
              : f.type === "password"
                ? 128
                : 2000),
        422,
        `Invalid ${f.key}`,
      );

      if (f.type !== "password") {
        v = v.trim();
      }

      // Email validation
      if (f.type === "email") {
        v = v.toLowerCase();

        assert(
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
          422,
          "Invalid email",
        );
      }

      // Date validation
      if (f.type === "date") {
        assert(
          /^\d{4}-\d{2}-\d{2}$/.test(v) &&
            !Number.isNaN(Date.parse(v)) &&
            new Date(v).toISOString().slice(0, 10) === v,
          422,
          `Invalid date: ${f.key}`,
        );
      }

      // Month validation
      if (f.type === "month") {
        assert(
          /^\d{4}-(0[1-9]|1[0-2])$/.test(v),
          422,
          "Invalid month",
        );
      }

      // Time validation
      if (f.type === "time") {
        assert(
          /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
          422,
          "Invalid time",
        );
      }

      // URL validation
      if (f.type === "url") {
        let url;

        try {
          url = new URL(v);
        } catch {}

        assert(
          url &&
            ["https:", "http:"].includes(url.protocol) &&
            !url.username &&
            !url.password,
          422,
          "Invalid HTTP(S) URL",
        );
      }

      // Select options
      if (f.options) {
        assert(
          f.options.includes(v),
          422,
          `Invalid ${f.key} option`,
        );
      }

      // Role validation
      if (f.type === "role") {
        assert(
          roles.includes(v),
          422,
          "Invalid role",
        );
      }
    }

    patch[f.key] = v;
  }

  // =====================================================
  // MERGE EXISTING RECORD WITH NEW VALUES
  // =====================================================

  const result = {
    ...(existing || {}),
    ...patch,
  };

  result.status =
    body.status ??
    existing?.status ??
    tab.statuses[0];

  assert(
    tab.statuses.includes(result.status),
    422,
    "Invalid status",
  );

  // =====================================================
  // REQUIRED FIELDS
  // =====================================================

  for (
    const key of new Set([
      ...(required[r] || []),
      ...tab.fields
        .filter((f) => f.required === true)
        .map((f) => f.key),
    ])
  ) {
    assert(
      result[key] !== undefined &&
        result[key] !== "" &&
        result[key] !== null,
      422,
      `${key} is required`,
    );
  }

  // =====================================================
  // PROJECT TASK / DIGITAL MARKETING TASK VALIDATION
  // =====================================================

  if (r === "tasks") {
    const hasProject = Boolean(result.projectId);
    const hasContent = Boolean(result.contentId);

    assert(
      hasProject !== hasContent,
      422,
      "Task must belong to either a Project or Digital Marketing Content",
    );

    if (hasContent) {
      assert(
        Boolean(result.marketingPlanId),
        422,
        "Monthly marketing plan is required for Digital Marketing tasks",
      );
    } else {
      assert(
        !result.marketingPlanId,
        422,
        "Project tasks cannot have a Digital Marketing plan",
      );
    }
  }
// Allow existing or manual customers for invoices
if (r === "invoices") {
  const hasExistingCustomer = Boolean(result.customerId);

  const hasManualCustomer = Boolean(
    String(result.manualCustomerName || "").trim()
  );

  assert(
    hasExistingCustomer !== hasManualCustomer,
    422,
    "Select an existing customer or enter a manual customer name"
  );

  assert(
    !(result.projectId && result.manualProjectName),
    422,
    "Select an existing project or enter a manual project name"
  );
}
  // =====================================================
  // DATE RANGE VALIDATION - FIXED
  // =====================================================

  for (const [start, end] of [
    ["startDate", "endDate"],
    ["invoiceDate", "dueDate"],
    ["startDate", "expiryDate"],
    ["startDate", "deadline"],
  ]) {
    if (result[start] && result[end]) {
      assert(
        result[end] >= result[start],
        422,
        `${end} must not precede ${start}`,
      );
    }
  }

  // =====================================================
  // POSITIVE AMOUNT VALIDATION
  // =====================================================

  if (
    [
      "payments",
      "installments",
      "promises",
      "subscriptions",
    ].includes(r)
  ) {
    assert(
      result.amount > 0,
      422,
      "Amount must be positive",
    );
  }

  // =====================================================
  // INVOICE / QUOTATION ITEMS
  // =====================================================

  if (["invoices", "quotations"].includes(r)) {
    if (body.items !== undefined) {
      assert(
        Array.isArray(body.items) &&
          body.items.length <= 100,
        422,
        "At most 100 line items",
      );

      result.items = body.items.map((i) => {
        assert(
          i &&
            Object.keys(i).every((k) =>
              [
                "description",
                "quantity",
                "unitPrice",
              ].includes(k),
            ),
          422,
          "Invalid line item fields",
        );

        assert(
          typeof i.description === "string" &&
            i.description.trim().length > 0 &&
            i.description.length <= 2000,
          422,
          "Line description required",
        );

        assert(
          typeof i.quantity === "number" &&
            i.quantity > 0 &&
            i.quantity <= 1e6 &&
            Math.abs(
              i.quantity * 1000 -
              Math.round(i.quantity * 1000),
            ) < 0.001,
          422,
          "Invalid quantity",
        );

        cents(i.unitPrice);

        return {
          description: i.description.trim(),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        };
      });
    }

    Object.assign(
      result,
      invoiceTotals(result),
    );
  }

  return result;
}
