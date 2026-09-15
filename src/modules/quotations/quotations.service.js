import { list, save, remove } from "../../services/record.service.js";
export const quotationsService = {
  list: (user, page, pageSize) => list(user, "quotations", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "quotations", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "quotations", body, id, config, key),
  remove: (user, id, revision) => remove(user, "quotations", id, revision),
};
