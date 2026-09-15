import { list, save, remove } from "../../services/record.service.js";
export const tasksService = {
  list: (user, page, pageSize) => list(user, "tasks", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "tasks", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "tasks", body, id, config, key),
  remove: (user, id, revision) => remove(user, "tasks", id, revision),
};
