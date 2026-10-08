import { models, transaction } from "../config/database.js";
import { Event } from "../models/system.model.js";

/* =========================================================
   CONFIG
========================================================= */

const NOTIFY_ROLES = [
  "owner",
  "admin",
  "accounts",
  "support",
];

const DEFAULT_REMINDER_DAYS = [
  30,
  15,
  7,
  1,
];


/* =========================================================
   DATE HELPERS
========================================================= */

/*
 * Convert any Date into YYYY-MM-DD using the
 * configured business timezone.
 */
function dateKey(value, timezone = "Asia/Kolkata") {

  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).formatToParts(date);

  const year =
    parts.find((x) => x.type === "year")?.value;

  const month =
    parts.find((x) => x.type === "month")?.value;

  const day =
    parts.find((x) => x.type === "day")?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}


/*
 * Today's YYYY-MM-DD in business timezone.
 */
function todayKey(timezone = "Asia/Kolkata") {

  return dateKey(
    new Date(),
    timezone,
  );
}


/*
 * Calendar-day difference.
 *
 * Example:
 *
 * today  = 2026-10-08
 * expiry = 2026-10-09
 *
 * result = 1
 */
function daysBetween(fromYmd, toYmd) {

  if (!fromYmd || !toYmd) {
    return null;
  }

  const [fromYear, fromMonth, fromDay] =
    fromYmd.split("-").map(Number);

  const [toYear, toMonth, toDay] =
    toYmd.split("-").map(Number);

  const from =
    Date.UTC(
      fromYear,
      fromMonth - 1,
      fromDay,
    );

  const to =
    Date.UTC(
      toYear,
      toMonth - 1,
      toDay,
    );

  return Math.round(
    (to - from) /
      (1000 * 60 * 60 * 24),
  );
}


/* =========================================================
   DISPLAY HELPERS
========================================================= */

function safeDomainName(record) {

  return String(
    record?.domainName || "Domain",
  );
}


async function customerName(
  customerId,
  session,
) {

  if (!customerId) {
    return "Customer";
  }

  const customer =
    await models.customers
      .findById(customerId)
      .session(session)
      .lean();

  return (
    customer?.businessName ||
    customer?.contactPerson ||
    "Customer"
  );
}


/* =========================================================
   RECIPIENTS
========================================================= */

async function notificationRecipients(
  session,
) {

  return models.users
    .find({
      role: {
        $in: NOTIFY_ROLES,
      },
      status: "ACTIVE",
    })
    .select("_id")
    .session(session)
    .lean();
}


/* =========================================================
   CREATE NOTIFICATION ONCE
========================================================= */

async function createNotificationOnce({
  recordId,
  reminderKey,
  type,
  message,
  session,
}) {

  /*
   * Atomic claim.
   *
   * Only one worker/process can add this reminder key.
   * This protects us if:
   *
   * - cron overlaps
   * - multiple Node instances are running
   * - server restarts
   */
  const claimed =
    await models.domainRenewals
      .findOneAndUpdate(
        {
          _id: recordId,
          sentReminderKeys: {
            $ne: reminderKey,
          },
        },
        {
          $addToSet: {
            sentReminderKeys:
              reminderKey,
          },
        },
        {
          session,
          returnDocument: "after",
        },
      )
      .lean();

  if (!claimed) {
    return false;
  }

  const recipients =
    await notificationRecipients(
      session,
    );

  if (!recipients.length) {
    return true;
  }

  await Event.insertMany(
    recipients.map((recipient) => ({
      recipientId:
        recipient._id,

      type,

      recordId,

      message,
    })),
    {
      session,
    },
  );

  return true;
}


/* =========================================================
   DOMAIN STATUS
========================================================= */

function calculateRenewalStatus(
  daysRemaining,
) {

  if (daysRemaining < 0) {
    return "EXPIRED";
  }

  if (daysRemaining === 0) {
    return "DUE_TODAY";
  }

  if (daysRemaining <= 30) {
    return "DUE_SOON";
  }

  return "ACTIVE";
}


/*
 * Temporary compatibility for the current Angular page.
 *
 * Later Angular will use renewalStatus directly.
 */
function legacyStatusFromRenewalStatus(
  renewalStatus,
) {

  switch (renewalStatus) {

    case "EXPIRED":
      return "EXPIRED";

    case "DUE_TODAY":
    case "DUE_SOON":
      return "DUE_SOON";

    default:
      return "ACTIVE";
  }
}


/* =========================================================
   EXPIRY REMINDER
========================================================= */

async function handleExpiryReminder({
  record,
  today,
  expiry,
  daysRemaining,
  session,
}) {

  if (record.reminderEnabled === false) {
    return;
  }

  const domain =
    safeDomainName(record);

  const customer =
    await customerName(
      record.customerId,
      session,
    );

  const reminderDays =
    Array.isArray(record.reminderDays) &&
    record.reminderDays.length
      ? record.reminderDays
      : DEFAULT_REMINDER_DAYS;


  /* -------------------------------------------------------
     30 / 15 / 7 / 1 DAYS
  ------------------------------------------------------- */

  if (
    daysRemaining > 0 &&
    reminderDays.includes(daysRemaining)
  ) {

    const reminderKey =
      `EXPIRY_${expiry}_${daysRemaining}`;

    const dayText =
      daysRemaining === 1
        ? "1 day"
        : `${daysRemaining} days`;

    await createNotificationOnce({
      recordId: record._id,

      reminderKey,

      type: "domain_renewal_due",

      message:
        `${customer} — ${domain} expires in ${dayText} (${expiry}).`,

      session,
    });

    return;
  }


  /* -------------------------------------------------------
     DUE TODAY
  ------------------------------------------------------- */

  if (daysRemaining === 0) {

    await createNotificationOnce({
      recordId: record._id,

      reminderKey:
        `EXPIRY_${expiry}_TODAY`,

      type:
        "domain_renewal_due_today",

      message:
        `${customer} — ${domain} expires today (${expiry}).`,

      session,
    });

    return;
  }


  /* -------------------------------------------------------
     EXPIRED

     One notification per expiry cycle.
  ------------------------------------------------------- */

  if (daysRemaining < 0) {

    await createNotificationOnce({
      recordId: record._id,

      reminderKey:
        `EXPIRED_${expiry}`,

      type:
        "domain_renewal_expired",

      message:
        `${customer} — ${domain} expired on ${expiry}. Renewal action is required.`,

      session,
    });

  }

}


/* =========================================================
   CUSTOMER FOLLOW-UP REMINDER
========================================================= */

async function handleFollowUpReminder({
  record,
  today,
  session,
}) {

  if (
    !record.nextFollowUpDate ||
    !record.followUpStatus ||
    record.followUpStatus === "NONE"
  ) {
    return;
  }

  const followUpDate =
    dateKey(
      record.nextFollowUpDate,
      "Asia/Kolkata",
    );

  if (!followUpDate) {
    return;
  }


  /*
   * <= means:
   *
   * If server was offline on the promised date,
   * the reminder is still created when server
   * comes back.
   */
  if (followUpDate > today) {
    return;
  }


  const domain =
    safeDomainName(record);

  const customer =
    await customerName(
      record.customerId,
      session,
    );


  await createNotificationOnce({
    recordId:
      record._id,

    reminderKey:
      `FOLLOWUP_${followUpDate}`,

    type:
      "domain_renewal_followup",

    message:
      `${customer} — follow up for ${domain}. Customer status: ${record.followUpStatus.replaceAll("_", " ")}.`,

    session,
  });

}


/* =========================================================
   PROCESS ONE DOMAIN
========================================================= */

async function processDomain(
  record,
  timezone,
) {

  const today =
    todayKey(timezone);

  const expiry =
    dateKey(
      record.expiryDate,
      timezone,
    );

  if (!today || !expiry) {
    return;
  }

  const daysRemaining =
    daysBetween(
      today,
      expiry,
    );

  if (daysRemaining === null) {
    return;
  }


  await transaction(
    async (session) => {

      /*
       * Reload inside transaction so we always work
       * with current MongoDB data.
       */
      const current =
        await models.domainRenewals
          .findById(record._id)
          .session(session)
          .lean();

      if (!current) {
        return;
      }


      const renewalStatus =
        calculateRenewalStatus(
          daysRemaining,
        );


      /*
       * Update real production domain state.
       *
       * The legacy status is maintained temporarily
       * for the current Angular UI.
       */
      await models.domainRenewals.updateOne(
        {
          _id: current._id,
        },
        {
          $set: {
            renewalStatus,

            status:
              legacyStatusFromRenewalStatus(
                renewalStatus,
              ),
          },
        },
        {
          session,
          runValidators: true,
        },
      );


      await handleExpiryReminder({
        record: current,
        today,
        expiry,
        daysRemaining,
        session,
      });


      await handleFollowUpReminder({
        record: current,
        today,
        session,
      });

    },
  );

}


/* =========================================================
   MAIN WORKER
========================================================= */

export async function runDomainRenewalReminders(
  config,
) {

  const timezone =
    config?.timezone ||
    "Asia/Kolkata";


  /*
   * Process all domain records.
   *
   * For AMI HUB's current volume this is fine.
   * Later, if records become very large, we can
   * change this to cursor/batch processing.
   */
  const domains =
    await models.domainRenewals
      .find({})
      .sort({
        expiryDate: 1,
      })
      .lean();


  let processed = 0;

  let failed = 0;


  for (const domain of domains) {

    try {

      await processDomain(
        domain,
        timezone,
      );

      processed += 1;

    } catch (error) {

      failed += 1;

      /*
       * Do not crash the entire job because one
       * customer/domain record has bad data.
       */
      console.error(
        "DOMAIN RENEWAL REMINDER ERROR:",
        {
          domainId:
            domain?._id,

          domainName:
            domain?.domainName,

          errorType:
            error?.name,

          message:
            error?.message,
        },
      );

    }

  }


  return {
    processed,
    failed,
  };

}