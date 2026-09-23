import { list, save, remove } from "../../services/record.service.js";

export const payrollService = {

  list: (user, page, pageSize) => list(user, "payroll", page, pageSize),

  create: (user, body, config, key) =>
    save(user, "payroll", body, null, config, key),

  update: (user, id, body, config, key) =>
    save(user, "payroll", body, id, config, key),

  remove: (user, id, revision) => remove(user, "payroll", id, revision),

};