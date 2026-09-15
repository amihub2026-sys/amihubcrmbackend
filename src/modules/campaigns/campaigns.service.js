import { list, save, remove } from "../../services/record.service.js";
export const campaignsService = {
  list: (user, page, pageSize) => list(user, "campaigns", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "campaigns", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "campaigns", body, id, config, key),
  remove: (user, id, revision) => remove(user, "campaigns", id, revision),
};
