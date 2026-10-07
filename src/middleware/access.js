import { models, plain } from "../config/database.js";

const edit = ["read", "create", "update", "export"],

  work = ["read", "update"],

  read = ["read"],

  selfLeave = ["read", "create"];

export const roles = [

  "owner",

  "admin",

  "hr",

  "sales",

  "telecaller",

  "project_manager",

  "developer",

  "designer",

  "video_editor",

  "digital_marketing",

  "accounts",

  "support",

];

export const grants = {

  sales: {

    visits: edit,

    promises: edit,

    leads: edit,

    calls: edit,

    followups: edit,

    meetings: edit,

    quotations: edit,

    customers: edit,

    leave: selfLeave,

  },

  telecaller: {

    leads: work,

    calls: ["read", "create"],

    followups: ["read", "create", "update"],

    meetings: read,

    leave: selfLeave,

  },

  project_manager: {

    visits: edit,

    customers: read,

    projects: edit,

    tasks: edit,

    files: edit,

    leave: selfLeave,

  },

  developer: {

    projects: read,

    tasks: work,

    files: edit,

    leave: selfLeave,

  },

  designer: {

    projects: read,

    tasks: work,

    files: edit,

    plans: read,

    content: work,

    leave: selfLeave,

  },

  video_editor: {

    projects: read,

    tasks: work,

    files: edit,

    plans: read,

    content: work,

    leave: selfLeave,

  },

  digital_marketing: {
    digitalMarketingPlans: edit,

    campaigns: edit,

    campaignLeads: edit,

    visits: edit,

    customers: read,

    plans: edit,

    content: edit,

    leave: selfLeave,

  },

  hr: {

    employees: edit,

    attendance: edit,

    attendanceSettings: edit,

    leave: edit,

    projects: read,

    tasks: read,

  },

  accounts: {

    employees: read,

    billingProfile: read,

    visits: read,

    promises: edit,

    subscriptions: edit,

    customers: read,

    invoices: edit,

    installments: edit,

    payments: edit,

    expenses: edit,

    payroll: edit,

    renewals: edit,

    leave: selfLeave,

  },

  support: {

    visits: edit,

    customers: read,

    tickets: edit,

    renewals: edit,

    leave: selfLeave,

  },

};

export const scoped = new Set([

  "telecaller",

  "project_manager",

  "developer",

  "designer",

  "video_editor",

  "digital_marketing",

  "support",

]);

export const privileged = (u) => ["owner", "admin"].includes(u.role);

export const can = (u, r, action = "read") =>

  Object.hasOwn(models, r) &&

  (privileged(u) || !!grants[u.role]?.[r]?.includes(action));

export function assignedQuery(u) {

  const ids = [u._id, u.employeeId].filter(Boolean);

  return {

    $or: [

      "assignedTo",

      "assignedEmployees",

      "projectManager",

      "employeeId",

      "accountManager",

    ].map((k) => ({ [k]: { $in: ids } })),

  };

}

async function ids(model, query, session) {

  return (

    await models[model].find(query).select("_id").session(session).lean()

  ).map((r) => r._id);

}

export async function scope(u, r, session = null) {

  if (

    r === "leave" &&

    !["owner", "admin", "hr"].includes(u.role)

  ) {

    return {

      employeeId: u.employeeId

    };

  }

  if (!scoped.has(u.role)) return {};

  const direct = assignedQuery(u),

    parts = [direct];

  if (["calls", "followups", "meetings"].includes(r))

    parts.push({ leadId: { $in: await ids("leads", direct, session) } });

  if (r === "files" || (r === "tasks" && u.role === "project_manager"))

    parts.push({ projectId: { $in: await ids("projects", direct, session) } });

  if (r === "content")

    parts.push({

      marketingPlanId: { $in: await ids("plans", direct, session) },

    });

  if (r === "customers") {

    const customers = [];

    for (const k of ["projects", "plans", "tickets", "renewals"])

      customers.push(

        ...(

          await models[k]

            .find(direct)

            .select("customerId")

            .session(session)

            .lean()

        ).map((x) => x.customerId),

      );

    parts.push({ _id: { $in: customers.filter(Boolean) } });

  }

  return { $or: parts };

}

export function redact(u, r, record) {

  const data = plain(record);

  if (

    ["projects", "tasks"].includes(r) &&

    !["owner", "admin", "accounts", "project_manager"].includes(u.role)

  )

    for (const k of [

      "budget",

      "subtotal",

      "tax",

      "discount",

      "paidAmount",

      "balanceAmount",

    ])

      delete data[k];

  return data;

}