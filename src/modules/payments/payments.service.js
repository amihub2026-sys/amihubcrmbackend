import { list, save, remove } from "../../services/record.service.js";
export const paymentsService = {
  list: (user, page, pageSize) => list(user, "payments", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "payments", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "payments", body, id, config, key),
  remove: (user, id, revision) => remove(user, "payments", id, revision),
};
