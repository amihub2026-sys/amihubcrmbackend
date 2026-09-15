import { models, Audit, Session } from "../config/database.js";
import { assert } from "../utils/index.js";
export async function audit(u, r, record, action, session) {
  await Audit.create(
    [
      {
        resource: r,
        recordId: record._id,
        text: `${action} ${r}`,
        actor: u.name,
        actorId: u._id,
        date: new Date(),
      },
    ],
    { session },
  );
}
export async function freshActor(u, session) {
  const actual = await models.users.findById(u._id).session(session).lean();
  assert(
    actual &&
      actual.status === "ACTIVE" &&
      actual.authVersion === u.authVersion,
    401,
    "Session expired",
  );
  return actual;
}
