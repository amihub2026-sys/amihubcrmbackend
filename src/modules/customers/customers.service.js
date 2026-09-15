import { list, save, remove } from "../../services/record.service.js";
export const customersService = {
  list: (user, page, pageSize) => list(user, "customers", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "customers", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "customers", body, id, config, key),
  remove: (user, id, revision) => remove(user, "customers", id, revision),
};
