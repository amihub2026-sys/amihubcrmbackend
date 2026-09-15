import { list, save, remove } from "../../services/record.service.js";
export const invoicesService = {
  list: (user, page, pageSize) => list(user, "invoices", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "invoices", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "invoices", body, id, config, key),
  remove: (user, id, revision) => remove(user, "invoices", id, revision),
};
