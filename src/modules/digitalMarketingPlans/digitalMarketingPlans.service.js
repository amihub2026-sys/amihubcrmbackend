import { list, save, remove } from "../../services/record.service.js";

export const digitalMarketingPlansService = {
  list: (user, page, pageSize) =>
    list(user, "digitalMarketingPlans", page, pageSize),

  create: (user, body, config, key) =>
    save(
      user,
      "digitalMarketingPlans",
      body,
      null,
      config,
      key,
    ),

  update: (user, id, body, config, key) =>
    save(
      user,
      "digitalMarketingPlans",
      body,
      id,
      config,
      key,
    ),

  remove: (user, id, revision) =>
    remove(
      user,
      "digitalMarketingPlans",
      id,
      revision,
    ),
};