import { models } from "../config/database.js";
import { can, scope } from "../middleware/access.js";
import { assert } from "../utils/index.js";
export async function getRecord(u, r, id, session = null) {
  assert(can(u, r), 403, "Access denied");
  const record = await models[r]
    .findOne({ $and: [{ _id: id }, await scope(u, r, session)] })
    .session(session)
    .lean();
  assert(record, 404, "Record not found");
  return record;
}
