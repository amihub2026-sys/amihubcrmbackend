import { list, save, remove } from "../../services/record.service.js";

export const domainRenewalsService = {

  list: (user, page, pageSize) =>
    list(user, "domainRenewals", page, pageSize),

  create: (user, body, config, key) =>
    save(
      user,
      "domainRenewals",
      body,
      null,
      config,
      key
    ),

  update: (user, id, body, config, key) =>
    save(
      user,
      "domainRenewals",
      body,
      id,
      config,
      key
    ),

  remove: (user, id, revision) =>
    remove(
      user,
      "domainRenewals",
      id,
      revision
    ),

};