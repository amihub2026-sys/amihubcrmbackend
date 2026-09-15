import { list, save, remove } from "../../services/record.service.js";
export const visitsService = {
  list: (user, page, pageSize) => list(user, "visits", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "visits", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "visits", body, id, config, key),
  remove: (user, id, revision) => remove(user, "visits", id, revision),
};
