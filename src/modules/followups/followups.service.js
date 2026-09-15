import { list, save, remove } from "../../services/record.service.js";
export const followupsService = {
  list: (user, page, pageSize) => list(user, "followups", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "followups", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "followups", body, id, config, key),
  remove: (user, id, revision) => remove(user, "followups", id, revision),
};
