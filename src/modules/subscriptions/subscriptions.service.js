import { list, save, remove } from "../../services/record.service.js";
export const subscriptionsService = {
  list: (user, page, pageSize) => list(user, "subscriptions", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "subscriptions", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "subscriptions", body, id, config, key),
  remove: (user, id, revision) => remove(user, "subscriptions", id, revision),
};
