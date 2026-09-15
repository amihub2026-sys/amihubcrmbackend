import { list, save, remove } from "../../services/record.service.js";
export const filesService = {
  list: (user, page, pageSize) => list(user, "files", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "files", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "files", body, id, config, key),
  remove: (user, id, revision) => remove(user, "files", id, revision),
};
