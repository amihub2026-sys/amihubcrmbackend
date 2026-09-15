import { list, save, remove } from "../../services/record.service.js";
export const departmentsService = {
  list: (user, page, pageSize) => list(user, "departments", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "departments", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "departments", body, id, config, key),
  remove: (user, id, revision) => remove(user, "departments", id, revision),
};
