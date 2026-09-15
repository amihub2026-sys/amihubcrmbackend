import { list, save, remove } from "../../services/record.service.js";
export const installmentsService = {
  list: (user, page, pageSize) => list(user, "installments", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "installments", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "installments", body, id, config, key),
  remove: (user, id, revision) => remove(user, "installments", id, revision),
};
