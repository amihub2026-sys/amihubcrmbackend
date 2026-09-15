import { list, save, remove } from "../../services/record.service.js";
export const expensesService = {
  list: (user, page, pageSize) => list(user, "expenses", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "expenses", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "expenses", body, id, config, key),
  remove: (user, id, revision) => remove(user, "expenses", id, revision),
};
