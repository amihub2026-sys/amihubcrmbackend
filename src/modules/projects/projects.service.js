import { list, save, remove } from "../../services/record.service.js";
export const projectsService = {
  list: (user, page, pageSize) => list(user, "projects", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "projects", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "projects", body, id, config, key),
  remove: (user, id, revision) => remove(user, "projects", id, revision),
};
