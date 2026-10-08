import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";

/* =========================================================
   DOMAIN NORMALIZATION
========================================================= */

function normalizeDomain(value) {
  if (!value) return "";

  let domain = String(value)
    .trim()
    .toLowerCase();

  // Allow user to paste:
  // https://example.com/
  // http://www.example.com/page
  try {
    if (
      domain.startsWith("http://") ||
      domain.startsWith("https://")
    ) {
      domain = new URL(domain).hostname;
    }
  } catch {
    // Keep original value.
    // Validation can handle invalid input later.
  }

  domain = domain
    .replace(/^www\./, "")
    .replace(/\/+$/, "");

  return domain;
}


/* =========================================================
   RENEWAL HISTORY
========================================================= */

const renewalHistorySchema = new mongoose.Schema(
  {
    previousExpiryDate: {
      type: Date,
      default: null,
    },

    newExpiryDate: {
      type: Date,
      required: true,
    },

    renewedAt: {
      type: Date,
      required: true,
    },

    renewalAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  },
);


/* =========================================================
   DOMAIN RENEWAL SCHEMA
========================================================= */

const schema = baseSchema({

  /* ---------------------------------------------------------
     CUSTOMER
  --------------------------------------------------------- */

  customerId: {
    type: String,
    required: true,
    trim: true,
  },


  /* ---------------------------------------------------------
     DOMAIN
  --------------------------------------------------------- */

  domainName: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    set: normalizeDomain,
  },

  provider: {
    type: String,
    trim: true,
    default: "",
  },


  /* ---------------------------------------------------------
     DOMAIN DATES
  --------------------------------------------------------- */

  purchaseDate: {
    type: Date,
    default: null,
  },

  expiryDate: {
    type: Date,
    required: true,
  },


  /* ---------------------------------------------------------
     AMOUNT
  --------------------------------------------------------- */

  renewalAmount: {
    type: Number,
    min: 0,
    default: 0,
  },


  /* =========================================================
     REAL DOMAIN STATE

     This represents ONLY the actual domain condition.

     ACTIVE
     DUE_SOON
     DUE_TODAY
     EXPIRED
  ========================================================= */

  renewalStatus: {
    type: String,
    enum: [
      "ACTIVE",
      "DUE_SOON",
      "DUE_TODAY",
      "EXPIRED",
    ],
    default: "ACTIVE",
    required: true,
  },


  /* =========================================================
     CUSTOMER FOLLOW-UP STATE

     Separate from domain expiry.

     Example:

     Domain:
       EXPIRED

     Customer:
       PROMISED_DATE

     Both can exist together.
  ========================================================= */

  followUpStatus: {
    type: String,
    enum: [
      "NONE",
      "PAYMENT_PENDING",
      "PROMISED_DATE",
      "ON_HOLD",
    ],
    default: "NONE",
    required: true,
  },


  /* =========================================================
     TEMPORARY LEGACY STATUS

     IMPORTANT:
     Keep this now because the existing Angular page currently
     uses "status".

     Later, after frontend migration, we can remove it.

     Do NOT use this as the production source of truth.
  ========================================================= */

  status: {
    type: String,
    enum: [
      "ACTIVE",
      "DUE_SOON",
      "PAYMENT_PENDING",
      "PROMISED_DATE",
      "ON_HOLD",
      "RENEWED",
      "EXPIRED",
    ],
    default: "ACTIVE",
  },


  /* =========================================================
     CUSTOMER FOLLOW-UP
  ========================================================= */

  nextFollowUpDate: {
    type: Date,
    default: null,
  },

  followUpNote: {
    type: String,
    trim: true,
    default: "",
  },


  /* =========================================================
     RENEWAL PROCESS

     Existing frontend currently sends newExpiryDate when
     status = RENEWED.

     Later the renewal service will move this value into
     expiryDate and clear it.
  ========================================================= */

  newExpiryDate: {
    type: Date,
    default: null,
  },

  lastRenewedAt: {
    type: Date,
    default: null,
  },


  /* =========================================================
     COMPLETE RENEWAL HISTORY

     Keeps old renewal cycles for audit/history.
  ========================================================= */

  renewalHistory: {
    type: [renewalHistorySchema],
    default: [],
  },


  /* =========================================================
     AUTOMATIC REMINDERS
  ========================================================= */

  reminderEnabled: {
    type: Boolean,
    default: true,
  },

  reminderDays: {
    type: [Number],
    default: [30, 15, 7, 1],
  },


  /* =========================================================
     DUPLICATE REMINDER PROTECTION

     Production keys should include expiry date.

     Examples:

     EXPIRY_2026-10-15_30
     EXPIRY_2026-10-15_15
     EXPIRY_2026-10-15_7
     EXPIRY_2026-10-15_1
     EXPIRY_2026-10-15_TODAY
     EXPIRED_2026-10-15

     FOLLOWUP_2026-10-12

     This prevents the same notification being generated
     repeatedly.
  ========================================================= */

  sentReminderKeys: {
    type: [String],
    default: [],
  },


  /* =========================================================
     INTERNAL NOTES
  ========================================================= */

  notes: {
    type: String,
    trim: true,
    default: "",
  },

});


/* =========================================================
   VALIDATION + LEGACY COMPATIBILITY
========================================================= */

schema.pre("validate", function () {

  /* ---------------------------------------------------------
     NORMALIZE REMINDER DAYS
  --------------------------------------------------------- */

  if (Array.isArray(this.reminderDays)) {

    this.reminderDays = [
      ...new Set(
        this.reminderDays
          .map(Number)
          .filter(
            (day) =>
              Number.isInteger(day) &&
              day > 0 &&
              day <= 365,
          ),
      ),
    ].sort((a, b) => b - a);

  }


  /* ---------------------------------------------------------
     EXISTING FRONTEND STATUS -> NEW PRODUCTION FIELDS

     This keeps your current page working while we migrate.
  --------------------------------------------------------- */

  if (this.isModified("status")) {

    switch (this.status) {

      case "ACTIVE":
        this.renewalStatus = "ACTIVE";
        this.followUpStatus = "NONE";
        break;


      case "DUE_SOON":
        this.renewalStatus = "DUE_SOON";
        break;


      case "EXPIRED":
        this.renewalStatus = "EXPIRED";
        break;


      case "PAYMENT_PENDING":
        this.followUpStatus = "PAYMENT_PENDING";
        break;


      case "PROMISED_DATE":
        this.followUpStatus = "PROMISED_DATE";
        break;


      case "ON_HOLD":
        this.followUpStatus = "ON_HOLD";
        break;


      /*
       * RENEWED is handled by the renewal service.
       * We do not immediately change renewalStatus here,
       * because the new expiry date must first be verified.
       */
      case "RENEWED":
        break;

    }

  }


  /* ---------------------------------------------------------
     PROMISED DATE MUST HAVE FOLLOW-UP DATE
  --------------------------------------------------------- */

  if (
    this.followUpStatus === "PROMISED_DATE" &&
    !this.nextFollowUpDate
  ) {

    this.invalidate(
      "nextFollowUpDate",
      "Next follow-up date is required when customer gives a promised date.",
    );

  }


  /* ---------------------------------------------------------
     RENEWED MUST HAVE NEW EXPIRY DATE
  --------------------------------------------------------- */

  if (this.status === "RENEWED") {

    if (!this.newExpiryDate) {

      this.invalidate(
        "newExpiryDate",
        "New expiry date is required when the domain is renewed.",
      );

    }

    if (
      this.expiryDate &&
      this.newExpiryDate &&
      this.newExpiryDate <= this.expiryDate
    ) {

      this.invalidate(
        "newExpiryDate",
        "New expiry date must be later than the current expiry date.",
      );

    }

  }

});


/* =========================================================
   INDEXES
========================================================= */

/*
 * Customer-wise domain lookup
 */
schema.index({
  customerId: 1,
});


/*
 * Main automatic expiry reminder worker query
 */
schema.index({
  renewalStatus: 1,
  expiryDate: 1,
});


/*
 * Customer promised-date / payment-follow-up worker query
 */
schema.index({
  followUpStatus: 1,
  nextFollowUpDate: 1,
});


/*
 * Quick expiry lookup
 */
schema.index({
  expiryDate: 1,
});


/*
 * Avoid duplicate domain entry for the same customer.
 */
schema.index(
  {
    customerId: 1,
    domainName: 1,
  },
  {
    unique: true,
  },
);


/* =========================================================
   MODEL
========================================================= */

export const domainRenewalsModel = mongoose.model(
  "domainRenewals",
  schema,
  "domainRenewals",
);