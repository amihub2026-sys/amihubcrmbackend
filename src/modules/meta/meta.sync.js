import { randomUUID } from 'node:crypto';
import { MetaAccount, MetaEntity, MetaReport, MetaDaily } from './meta.models.js';
import { MetaGraph, MetaGraphError } from './meta.graph.js';
import { metrics, accountDates, validateRange } from './meta.metrics.js';
import { models, transaction } from '../../config/database.js';
import { assert } from '../../utils/index.js';

const fields = 'spend,impressions,clicks,reach,actions';

function targetingSummary(targeting = {}) {
  const geo = targeting.geo_locations || {};

  return [
    targeting.age_min
      ? `Age ${targeting.age_min}–${targeting.age_max || '65+'}`
      : '',
    ...(geo.countries || []),
    ...(geo.regions || []).map((x) => x.name || x.key),
    ...(geo.cities || []).map((x) => x.name || x.key),
    ...(targeting.publisher_platforms || []),
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 1500);
}

export async function collectAccount(graph, account, now = new Date()) {
  const meta = await graph.get(account.metaAccountId, {
    fields: 'id,name,currency,timezone_name,account_status',
  });

  assert(
    meta.id === account.metaAccountId &&
      meta.currency === account.currency &&
      meta.timezone_name,
    422,
    'Meta account identity/currency changed. Reconnect the account.'
  );

  const { today, monthStart } = accountDates(meta.timezone_name, now);

  const requested = validateRange(
    account.requestedFrom || monthStart,
    account.requestedTo || today
  );

  assert(
    requested.to <= today,
    422,
    'Requested report is in the future for this account'
  );

  const campaigns = await graph.list(`${account.metaAccountId}/campaigns`, {
    fields:
      'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time',
  });

  const adsets = await graph.list(`${account.metaAccountId}/adsets`, {
    fields:
      'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,optimization_goal,targeting',
  });

  const ads = await graph.list(`${account.metaAccountId}/ads`, {
    fields:
      'id,name,campaign_id,adset_id,status,effective_status',
  });

  const entities = [];

  for (const [kind, rows] of [
    ['campaign', campaigns],
    ['adset', adsets],
    ['ad', ads],
  ]) {
    for (const row of rows) {
      assert(
        typeof row.id === 'string' && /^\d+$/.test(row.id),
        422,
        'Meta returned an invalid entity ID'
      );

      entities.push({
        accountId: account._id,
        metaId: row.id,
        kind,

        name: row.name,
        campaignId: row.campaign_id,
        adsetId: row.adset_id,

        status: row.status,
        effectiveStatus: row.effective_status,
        objective: row.objective,

        dailyBudgetMinor: row.daily_budget,
        lifetimeBudgetMinor: row.lifetime_budget,

        startTime: row.start_time,
        stopTime: row.stop_time || row.end_time,

        optimizationGoal: row.optimization_goal,

        targetingSummary:
          kind === 'adset'
            ? targetingSummary(row.targeting)
            : '',
      });
    }
  }

  const uniqueRanges = new Map(
    [
      requested,
      { from: monthStart, to: today },
      { from: today, to: today },
    ].map((range) => [`${range.from}:${range.to}`, range])
  );

  const reports = [];

  for (const { from, to } of uniqueRanges.values()) {
    const params = {
      time_range: {
        since: from,
        until: to,
      },

      action_report_time: 'impression',
      use_unified_attribution_setting: true,
    };

    const totals = await graph.list(`${account.metaAccountId}/insights`, {
      ...params,
      level: 'account',
      fields,
    });

    assert(
      totals.length <= 1,
      422,
      'Meta returned multiple account totals for one reporting period'
    );

    const campaignInsights = await graph.list(
      `${account.metaAccountId}/insights`,
      {
        ...params,
        level: 'campaign',
        fields: 'campaign_id,campaign_name,' + fields,
      }
    );

    reports.push({
      accountId: account._id,
      from,
      to,

      currency: meta.currency,
      timezone: meta.timezone_name,

      syncedAt: now,

      totals: metrics(totals[0]),

      campaigns: campaignInsights.map((row) => ({
        metaId: row.campaign_id,
        name: row.campaign_name,
        ...metrics(row),
      })),
    });
  }

  // Re-fetch recent days: attribution/conversions can revise earlier daily totals.
  const lookback = new Date(today + 'T00:00:00Z');

  lookback.setUTCDate(
    lookback.getUTCDate() - 34
  );

  const recent = {
    from: lookback.toISOString().slice(0, 10),
    to: today,
  };

  const windows = [recent];

  if (requested.from < recent.from) {
    windows.push(requested);
  }

  const daily = new Map();

  for (const range of windows) {
    const rows = await graph.list(`${account.metaAccountId}/insights`, {
      fields: 'date_start,' + fields,

      level: 'account',
      time_increment: 1,

      time_range: {
        since: range.from,
        until: range.to,
      },

      action_report_time: 'impression',
      use_unified_attribution_setting: true,
    });

    // Persist zero days too, so missing data remains distinguishable from a known zero.
    const date = new Date(range.from + 'T00:00:00Z');

    while (date.toISOString().slice(0, 10) <= range.to) {
      const day = date.toISOString().slice(0, 10);

      daily.set(day, {
        accountId: account._id,
        date: day,
        currency: meta.currency,
        syncedAt: now,
        ...metrics(),
      });

      date.setUTCDate(
        date.getUTCDate() + 1
      );
    }

    for (const row of rows) {
      validateRange(
        row.date_start,
        row.date_start
      );

      assert(
        row.date_start >= range.from &&
          row.date_start <= range.to,
        422,
        'Meta returned a daily row outside the requested range'
      );

      daily.set(row.date_start, {
        accountId: account._id,
        date: row.date_start,
        currency: meta.currency,
        syncedAt: now,
        ...metrics(row),
      });
    }
  }

  return {
    meta,
    entities,
    reports,
    daily: [...daily.values()],
    windows,
  };
}

export async function runOneSync(
  config,
  {
    graphFactory = (key, heartbeat) =>
      new MetaGraph(config, key, { heartbeat }),
  } = {}
) {
  const now = new Date();
  const lockToken = randomUUID();

  const account =
    await MetaAccount.findOneAndUpdate(
      {
        enabled: true,

        $or: [
          {
            syncState: 'QUEUED',
          },
          {
            syncState: {
              $in: ['IDLE', 'ERROR'],
            },
            nextSyncAt: {
              $lte: now,
            },
          },
          {
            syncState: 'RUNNING',
            lockUntil: {
              $lt: now,
            },
          },
        ],
      },
      {
        $set: {
          syncState: 'RUNNING',
          lockToken,
          lockUntil: new Date(
            Date.now() + 120000
          ),
        },
      },
      {
        returnDocument: 'after',
        sort: {
          nextSyncAt: 1,
        },
      }
    )
      .select(
        '+connectionKey +lockToken'
      )
      .lean();

  if (!account) {
    return false;
  }

  const started = Date.now();

  const heartbeat = async () => {
    assert(
      Date.now() - started <
        15 * 60 * 1000,
      422,
      'Meta sync exceeded 15 minutes. Reduce account/report size.'
    );

    const lease =
      await MetaAccount.updateOne(
        {
          _id: account._id,
          lockToken,
          syncState: 'RUNNING',
          enabled: true,
        },
        {
          $set: {
            lockUntil: new Date(
              Date.now() + 120000
            ),
          },
        }
      );

    assert(
      lease.matchedCount === 1,
      409,
      'Sync lease was lost'
    );
  };

  try {
    assert(
      await models.customers.exists({
        _id: account.customerId,
      }),
      422,
      'Linked CRM customer no longer exists'
    );

    const snapshot =
      await collectAccount(
        graphFactory(
          account.connectionKey,
          heartbeat
        ),
        account
      );

    await heartbeat();

    await transaction(async (session) => {
      // Fencing token prevents an expired worker from overwriting a newer sync.
      const claimed =
        await MetaAccount.updateOne(
          {
            _id: account._id,
            lockToken,
            syncState: 'RUNNING',
            enabled: true,
          },
          {
            $set: {
              syncState: 'IDLE',
              syncError: '',

              lastSyncedAt:
                new Date(),

              nextSyncAt:
                new Date(
                  Date.now() +
                    (config.meta?.syncMinutes ||
                      180) *
                      60000
                ),

              name:
                snapshot.meta.name,

              timezone:
                snapshot.meta.timezone_name,

              accountStatus:
                snapshot.meta.account_status,

              requestedFrom: '',
              requestedTo: '',

              lockUntil:
                new Date(0),
            },

            $unset: {
              lockToken: 1,
            },
          },
          {
            session,
          }
        );

      assert(
        claimed.matchedCount === 1,
        409,
        'Sync lease was lost'
      );

      await MetaEntity.deleteMany({
        accountId: account._id,
      }).session(session);

      if (snapshot.entities.length) {
        await MetaEntity.insertMany(
          snapshot.entities,
          {
            session,
          }
        );
      }

      for (const report of snapshot.reports) {
        await MetaReport.updateOne(
          {
            accountId: account._id,
            from: report.from,
            to: report.to,
          },
          {
            $set: report,
          },
          {
            upsert: true,
            session,
            runValidators: true,
          }
        );
      }

      for (const window of snapshot.windows) {
        await MetaDaily.deleteMany({
          accountId: account._id,

          date: {
            $gte: window.from,
            $lte: window.to,
          },
        }).session(session);
      }

      if (snapshot.daily.length) {
        await MetaDaily.insertMany(
          snapshot.daily,
          {
            session,
          }
        );
      }
    });
  } catch (error) {
    // Do not persist raw network errors, URLs or token-bearing provider messages.
    const message =
      error instanceof MetaGraphError
        ? error.message
        : error.status === 422
          ? error.message
          : 'Sync could not complete. Previous successful data was retained; check the worker and retry.';

    await MetaAccount.updateOne(
      {
        _id: account._id,
        lockToken,
      },
      {
        $set: {
          syncState: 'ERROR',
          syncError: message,

          nextSyncAt:
            new Date(
              Date.now() +
                (error.transient
                  ? 15
                  : config.meta?.syncMinutes ||
                    180) *
                  60000
            ),

          lockUntil:
            new Date(0),
        },

        $unset: {
          lockToken: 1,
        },
      }
    );
  }

  return true;
}