import { list, save, remove } from "../../services/record.service.js";

export const attendanceSettingsService = {
  list: (user, page, pageSize) =>
    list(user, "attendanceSettings", page, pageSize),

  create: (user, body, config, key) =>
    save(user, "attendanceSettings", body, null, config, key),

  update: (user, id, body, config, key) =>
    save(user, "attendanceSettings", body, id, config, key),

  remove: (user, id, revision) =>
    remove(user, "attendanceSettings", id, revision),
};