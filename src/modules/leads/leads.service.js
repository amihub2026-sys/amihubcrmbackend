import { list, save, remove } from "../../services/record.service.js";
export const leadsService = {
  list: (user, page, pageSize) => list(user, "leads", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "leads", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "leads", body, id, config, key),
  remove: (user, id, revision) => remove(user, "leads", id, revision),
};
