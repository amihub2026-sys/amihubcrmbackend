import { list, save, remove } from "../../services/record.service.js";
export const renewalsService = {
  list: (user, page, pageSize) => list(user, "renewals", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "renewals", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "renewals", body, id, config, key),
  remove: (user, id, revision) => remove(user, "renewals", id, revision),
};
