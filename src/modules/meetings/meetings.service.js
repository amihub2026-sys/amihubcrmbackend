import { list, save, remove } from "../../services/record.service.js";
export const meetingsService = {
  list: (user, page, pageSize) => list(user, "meetings", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "meetings", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "meetings", body, id, config, key),
  remove: (user, id, revision) => remove(user, "meetings", id, revision),
};
