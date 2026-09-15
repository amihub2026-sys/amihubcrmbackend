import { list, save, remove } from "../../services/record.service.js";
export const usersService = {
  list: (user, page, pageSize) => list(user, "users", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "users", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "users", body, id, config, key),
  remove: (user, id, revision) => remove(user, "users", id, revision),
};
