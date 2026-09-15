import { models, transaction, plain } from "../config/database.js";
import { can } from "../middleware/access.js";
import { assert } from "../utils/index.js";
import { audit, freshActor } from "./context.service.js";
import { getRecord } from "./query.service.js";
export async function convert(u, id) {
  assert(
    can(u, "leads", "update") && can(u, "customers", "create"),
    403,
    "Access denied",
  );
  return transaction(async (session) => {
    u = await freshActor(u, session);
    const lead = await getRecord(u, "leads", id, session);
    const prior = await models.customers
      .findOne({ sourceLeadId: id })
      .session(session)
      .lean();
    if (prior) return plain(prior);
    assert(lead.status === "WON", 422, "Only Won leads can become customers");
    const [customer] = await models.customers.create(
      [
        {
          businessName: lead.businessName,
          contactPerson: lead.contactPerson,
          phone: lead.phone,
          email: lead.email,
          location: lead.location,
          services: lead.interestedServices,
          accountManager: lead.assignedTo,
          sourceLeadId: id,
          status: "ACTIVE",
          createdBy: u._id,
        },
      ],
      { session },
    );
    await models.leads.updateOne(
      { _id: id },
      { $set: { convertedCustomerId: customer._id }, $inc: { revision: 1 } },
      { session },
    );
    await audit(u, "customers", customer, "Converted lead", session);
    return plain(customer);
  });
}
