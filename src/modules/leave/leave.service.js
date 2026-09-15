import { list, save, remove } from "../../services/record.service.js";
export const leaveService = {
  list: (user, page, pageSize) => list(user, "leave", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "leave", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "leave", body, id, config, key),
  remove: (user, id, revision) => remove(user, "leave", id, revision),
};
