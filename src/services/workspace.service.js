import { models, Audit, plain } from "../config/database.js";
import { resources } from "../config/database.js";
import { can, scope, privileged } from "../middleware/access.js";
export async function bootstrap(u) {
  const allowed = Object.keys(resources).filter((r) => can(u, r));
  // Minimal directory for assignment widgets; no employee email, phone, or HR data.
  const directory = await models.employees
    .find({ status: { $ne: "INACTIVE" } })
    .select("_id name")
    .lean();
  const projects = can(u, "projects")
    ? await models.projects
        .find(await scope(u, "projects"))
        .select("_id projectName customerId")
        .lean()
    : [];
  const invoiceDirectory =
    can(u, "invoices") || can(u, "promises")
      ? await models.invoices
          .find({})
          .select("_id invoiceNumber customerId")
          .lean()
      : [];
  const activity = privileged(u)
    ? await Audit.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .select("text actor date")
        .lean()
    : [];
  return {
    resources: allowed,
    directory: directory.map(plain),
    projectDirectory: projects.map(plain),
    invoiceDirectory: invoiceDirectory.map(plain),
    activity,
  };
}
