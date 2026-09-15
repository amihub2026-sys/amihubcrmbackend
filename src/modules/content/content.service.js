import { list, save, remove } from "../../services/record.service.js";
export const contentService = {
  list: (user, page, pageSize) => list(user, "content", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "content", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "content", body, id, config, key),
  remove: (user, id, revision) => remove(user, "content", id, revision),
};
