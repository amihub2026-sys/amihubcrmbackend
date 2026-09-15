import { list, save, remove } from "../../services/record.service.js";
export const plansService = {
  list: (user, page, pageSize) => list(user, "plans", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "plans", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "plans", body, id, config, key),
  remove: (user, id, revision) => remove(user, "plans", id, revision),
};
