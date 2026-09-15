import { list, save, remove } from "../../services/record.service.js";
export const employeesService = {
  list: (user, page, pageSize) => list(user, "employees", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "employees", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "employees", body, id, config, key),
  remove: (user, id, revision) => remove(user, "employees", id, revision),
};
