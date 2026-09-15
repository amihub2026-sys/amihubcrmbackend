import { list, save, remove } from "../../services/record.service.js";
export const ticketsService = {
  list: (user, page, pageSize) => list(user, "tickets", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "tickets", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "tickets", body, id, config, key),
  remove: (user, id, revision) => remove(user, "tickets", id, revision),
};
