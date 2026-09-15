import { list, save, remove } from "../../services/record.service.js";
export const servicesService = {
  list: (user, page, pageSize) => list(user, "services", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "services", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "services", body, id, config, key),
  remove: (user, id, revision) => remove(user, "services", id, revision),
};
