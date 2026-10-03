import { assert } from "../../utils/index.js";

export const round = (value) =>
  Math.round((value + Number.EPSILON) * 1e6) / 1e6;

// Validate numeric values received from Meta.

function number(value) {
  const result = Number(value || 0);

  assert(
    Number.isFinite(result) && result >= 0,
    422,
    "Meta returned an invalid metric",
  );

  return result;
}

// Calculate metrics for one Meta Insights record.

export function metrics(row = {}) {
  // Use the aggregate lead count.
  // Adding its subtypes again would double-count leads.
const actions = row.actions || [];

const leadAction = actions.find(
  (action) => action.action_type === "lead",
);

const messageAction = actions.find(
  (action) =>
    action.action_type ===
    "onsite_conversion.messaging_conversation_started_7d",
);

const leads = leadAction
  ? number(leadAction.value)
  : messageAction
    ? number(messageAction.value)
    : 0;
  const spend = number(row.spend);
  const impressions = number(row.impressions);
  const clicks = number(row.clicks);

  return {
    spend,
    impressions,
    clicks,
    leads,
    reach: number(row.reach),

    cpl: leads
      ? round(spend / leads)
      : null,

    ctr: impressions
      ? round((clicks / impressions) * 100)
      : null,

    cpm: impressions
      ? round((spend / impressions) * 1000)
      : null,
  };
}

// Combine additive metrics and recalculate ratios.

export function sumMetrics(rows) {
  const total = rows.reduce(
    (result, row) => {
      for (const key of [
        "spend",
        "impressions",
        "clicks",
        "leads",
      ]) {
        result[key] = round(
          result[key] + (row[key] || 0),
        );
      }

      return result;
    },
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
    },
  );

  return {
    ...total,

    // People can overlap across accounts and dates.
    // Reach must not be added together.
    reach: null,

    cpl: total.leads
      ? round(total.spend / total.leads)
      : null,

    ctr: total.impressions
      ? round((total.clicks / total.impressions) * 100)
      : null,

    cpm: total.impressions
      ? round((total.spend / total.impressions) * 1000)
      : null,
  };
}

// Validate a reporting range of up to 93 days.

export function validateRange(from, to) {
  const valid = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value + "T00:00:00Z")
      .toISOString()
      .slice(0, 10) === value;

  assert(
    valid(from) && valid(to) && from <= to,
    422,
    "Use a valid date range (YYYY-MM-DD)",
  );

  assert(
    (Date.parse(to) - Date.parse(from)) / 86400000 <= 92,
    422,
    "Select at most 93 days per sync/report",
  );

  return { from, to };
}

// Determine today using the Meta ad account's timezone.

export function accountDates(timezone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );

  const today =
    `${parts.year}-${parts.month}-${parts.day}`;

  return {
    today,
    monthStart: today.slice(0, 7) + "-01",
  };
}