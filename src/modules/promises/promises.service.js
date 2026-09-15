import { list, save, remove } from "../../services/record.service.js";
export const promisesService = {
  list: (user, page, pageSize) => list(user, "promises", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "promises", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "promises", body, id, config, key),
  remove: (user, id, revision) => remove(user, "promises", id, revision),
};
