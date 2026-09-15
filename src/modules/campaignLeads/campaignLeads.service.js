import { list, save, remove } from "../../services/record.service.js";
export const campaignLeadsService = {
  list: (user, page, pageSize) => list(user, "campaignLeads", page, pageSize),
  create: (user, body, config, key) =>
    save(user, "campaignLeads", body, null, config, key),
  update: (user, id, body, config, key) =>
    save(user, "campaignLeads", body, id, config, key),
  remove: (user, id, revision) => remove(user, "campaignLeads", id, revision),
};
