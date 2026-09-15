import { list, save, remove } from "../../services/record.service.js";
export const callsService = {
  list: (user, page, pageSize) => list(user, "calls", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "calls", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "calls", body, id, config, key),
  remove: (user, id, revision) => remove(user, "calls", id, revision),
};
