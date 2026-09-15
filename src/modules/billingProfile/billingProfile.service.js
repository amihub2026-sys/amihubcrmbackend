import { list, save, remove } from "../../services/record.service.js";
export const billingProfileService = {
  list: (user, page, pageSize) => list(user, "billingProfile", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "billingProfile", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "billingProfile", body, id, config, key),
  remove: (user, id, revision) => remove(user, "billingProfile", id, revision),
};
