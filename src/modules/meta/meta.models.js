import mongoose from "mongoose";
import { baseSchema } from "../../models/base-schema.js";

// META AD ACCOUNTS
// Tokens are kept in the backend environment, not in MongoDB.

const account = baseSchema({
  customerId: {
    type: String,
    required: true,
    index: true,
  },

  metaAccountId: {
    type: String,
    required: true,
    unique: true,
  },

  connectionKey: {
    type: String,
    required: true,
    select: false,
  },

  name: String,
  currency: String,
  timezone: String,
  accountStatus: Number,

  enabled: {
    type: Boolean,
    default: true,
  },

  lastSyncedAt: Date,

  nextSyncAt: {
    type: Date,
    default: Date.now,
  },

  syncState: {
    type: String,
    enum: ["IDLE", "QUEUED", "RUNNING", "ERROR"],
    default: "IDLE",
  },

  syncError: String,
  requestedFrom: String,
  requestedTo: String,

  lockToken: {
    type: String,
    select: false,
  },

  lockUntil: Date,
});

account.index({
  enabled: 1,
  nextSyncAt: 1,
});

export const MetaAccount = mongoose.model(
  "MetaAccount",
  account,
  "meta_accounts",
);

// CAMPAIGNS, AD SETS, AND ADS

const entity = baseSchema({
  accountId: {
    type: String,
    required: true,
  },

  metaId: {
    type: String,
    required: true,
  },

  kind: {
    type: String,
    enum: ["campaign", "adset", "ad"],
    required: true,
  },

  name: String,
  campaignId: String,
  adsetId: String,

  status: String,
  effectiveStatus: String,
  objective: String,

  dailyBudgetMinor: String,
  lifetimeBudgetMinor: String,

  startTime: String,
  stopTime: String,
  optimizationGoal: String,
  targetingSummary: String,
});

entity.index(
  {
    accountId: 1,
    kind: 1,
    metaId: 1,
  },
  {
    unique: true,
  },
);

export const MetaEntity = mongoose.model(
  "MetaEntity",
  entity,
  "meta_entities",
);

// SHARED PERFORMANCE FIELDS

const metrics = {
  spend: Number,
  impressions: Number,
  clicks: Number,
  leads: Number,
  reach: Number,
  cpl: Number,
  ctr: Number,
  cpm: Number,
};

// REPORTS FOR A SELECTED DATE RANGE

const report = baseSchema({
  accountId: {
    type: String,
    required: true,
  },

  from: {
    type: String,
    required: true,
  },

  to: {
    type: String,
    required: true,
  },

  currency: String,
  timezone: String,
  syncedAt: Date,

  totals: {
    type: new mongoose.Schema(metrics, {
      _id: false,
    }),
  },

  campaigns: [
    {
      _id: false,
      metaId: String,
      name: String,
      ...metrics,
    },
  ],
});

report.index(
  {
    accountId: 1,
    from: 1,
    to: 1,
  },
  {
    unique: true,
  },
);

export const MetaReport = mongoose.model(
  "MetaReport",
  report,
  "meta_reports",
);

// DAILY PERFORMANCE

const daily = baseSchema({
  accountId: {
    type: String,
    required: true,
  },

  date: {
    type: String,
    required: true,
  },

  currency: String,
  syncedAt: Date,

  ...metrics,
});

daily.index(
  {
    accountId: 1,
    date: 1,
  },
  {
    unique: true,
  },
);

export const MetaDaily = mongoose.model(
  "MetaDaily",
  daily,
  "meta_daily_insights",
);

// USED WHEN INITIALIZING DATABASE INDEXES

export const metaModels = [
  MetaAccount,
  MetaEntity,
  MetaReport,
  MetaDaily,
];