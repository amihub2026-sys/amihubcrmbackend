import { MetaAccount, MetaEntity, MetaReport, MetaDaily } from './meta.models.js';
import { MetaGraph } from './meta.graph.js';
import { accountDates, validateRange, sumMetrics, metrics } from './meta.metrics.js';
import { models, transaction, plain } from '../../config/database.js';
import { can, scope, privileged } from '../../middleware/access.js';
import { audit, freshActor } from '../../services/context.service.js';
import { assert } from '../../utils/index.js';

export function authorize(user, manage = false) {
  assert(manage ? privileged(user) : can(user, 'campaigns'), 403, 'Meta Ads access denied');
}

export async function customerFilter(user) {
  authorize(user);
  return scope(user, 'customers');
}

export async function visibleAccounts(user, customerId) {
  const customerQuery = await customerFilter(user);

  if (customerId !== undefined) {
    assert(
      typeof customerId === 'string' && customerId.length <= 100,
      422,
      'Invalid customer'
    );
  }

  const customers = await models.customers
    .find(customerQuery)
    .select('_id businessName accountManager')
    .lean();

  if (customerId) {
    assert(
      customers.some((c) => c._id === customerId),
      404,
      'Customer not found'
    );
  }

  const ids = customerId
    ? [customerId]
    : customers.map((c) => c._id);

  const accounts = await MetaAccount.find({
    customerId: { $in: ids },
  })
    .sort({ name: 1 })
    .lean();

  return { customers, accounts };
}

export function safeAccount(row, config) {
  const result = plain(row);

  delete result.connectionKey;
  delete result.lockToken;
  delete result.lockUntil;
  delete result.requestedFrom;
  delete result.requestedTo;

  if (
    row.syncState === 'RUNNING' &&
    row.lockUntil < new Date()
  ) {
    result.syncState = 'QUEUED';
  }

  result.syncMinutes = config.meta?.syncMinutes || 180;

  return result;
}

export async function bootstrap(user, config) {
  const { customers, accounts } = await visibleAccounts(user);

  return {
    canManage: privileged(user),

    configured:
      !!Object.keys(config.meta?.connections || {}).length,

    connections: privileged(user)
      ? Object.keys(config.meta?.connections || {})
      : [],

    customers: customers.map(plain),

    accounts: accounts.map((x) =>
      safeAccount(x, config)
    ),
  };
}

export async function findAccount(user, id, secret = false) {
  authorize(user);

  assert(
    typeof id === 'string' && id.length <= 100,
    422,
    'Invalid account'
  );

  const query = MetaAccount.findById(id);

  if (secret) {
    query.select('+connectionKey');
  }

  const account = await query.lean();

  assert(account, 404, 'Ad account not found');

  const customer = await models.customers
    .findOne({
      $and: [
        { _id: account.customerId },
        await customerFilter(user),
      ],
    })
    .lean();

  assert(customer, 404, 'Ad account not found');

  return account;
}

export async function linkAccount(user, body, config) {
  authorize(user, true);

  assert(
    body &&
      typeof body.customerId === 'string' &&
      body.customerId.length <= 100,
    422,
    'Select an existing CRM customer'
  );

  assert(
    typeof body.metaAccountId === 'string' &&
      /^(act_)?\d{1,40}$/.test(body.metaAccountId),
    422,
    'Enter the numeric Meta ad account ID'
  );

  assert(
    typeof body.connectionKey === 'string' &&
      Object.hasOwn(
        config.meta?.connections || {},
        body.connectionKey
      ),
    422,
    'Select a configured backend connection'
  );

  const metaAccountId =
    'act_' +
    body.metaAccountId.replace(/^act_/, '');

  const graph = new MetaGraph(
    config,
    body.connectionKey
  );

  const meta = await graph.get(metaAccountId, {
    fields:
      'id,name,currency,timezone_name,account_status',
  });

  assert(
    meta.id === metaAccountId &&
      /^[A-Z]{3}$/.test(meta.currency) &&
      meta.timezone_name,
    422,
    'Meta returned incomplete account information'
  );

  accountDates(meta.timezone_name);

  return transaction(async (session) => {
    user = await freshActor(user, session);

    authorize(user, true);

    assert(
      await models.customers
        .exists({ _id: body.customerId })
        .session(session),
      422,
      'Customer no longer exists'
    );

    const existing = await MetaAccount.findOne({
      metaAccountId,
    })
      .session(session)
      .lean();

    assert(
      !existing ||
        existing.customerId === body.customerId,
      409,
      'This Meta account is already linked to a different client. Its history cannot be reassigned.'
    );

    assert(
      !existing ||
        existing.syncState !== 'RUNNING' ||
        existing.lockUntil < new Date(),
      409,
      'Wait for the current sync before changing the connection'
    );

    const values = {
      customerId: body.customerId,
      metaAccountId,
      connectionKey: body.connectionKey,

      name: meta.name,
      currency: meta.currency,
      timezone: meta.timezone_name,
      accountStatus: meta.account_status,

      enabled: true,
      syncState: 'QUEUED',
      syncError: '',
      nextSyncAt: new Date(),

      requestedFrom: '',
      requestedTo: '',
      lockUntil: new Date(0),
    };

    const row =
      await MetaAccount.findOneAndUpdate(
        { metaAccountId },
        {
          $set: values,
          $setOnInsert: {
            createdBy: user._id,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          session,
          runValidators: true,
        }
      ).lean();

    await audit(
      user,
      'metaAccounts',
      row,
      existing ? 'Reconnected' : 'Linked',
      session
    );

    return safeAccount(row, config);
  });
}

export async function setEnabled(
  user,
  id,
  enabled,
  config
) {
  authorize(user, true);

  assert(
    typeof enabled === 'boolean',
    422,
    'enabled must be true or false'
  );

  return transaction(async (session) => {
    user = await freshActor(user, session);

    authorize(user, true);

    const existing =
      await MetaAccount.findById(id)
        .session(session)
        .lean();

    assert(
      existing,
      404,
      'Ad account not found'
    );

    assert(
      existing.syncState !== 'RUNNING' ||
        existing.lockUntil < new Date(),
      409,
      'Wait for the current sync before changing this account'
    );

    const row =
      await MetaAccount.findByIdAndUpdate(
        id,
        {
          $set: {
            enabled,

            syncState: enabled
              ? 'QUEUED'
              : 'IDLE',

            nextSyncAt: new Date(),

            syncError: '',
            requestedFrom: '',
            requestedTo: '',
          },
        },
        {
          returnDocument: 'after',
          session,
        }
      ).lean();

    await audit(
      user,
      'metaAccounts',
      row,
      enabled
        ? 'Resumed sync for'
        : 'Paused sync for',
      session
    );

    return safeAccount(row, config);
  });
}

export async function queueSync(
  user,
  id,
  body,
  config
) {
  const account = await findAccount(user, id);

  assert(
    account.enabled,
    409,
    'Resume account syncing first'
  );

  const { today, monthStart } =
    accountDates(account.timezone);

  const range = validateRange(
    body?.from || monthStart,
    body?.to || today
  );

  assert(
    range.to <= today,
    422,
    'Report end date is in the future for this ad account'
  );

  const row =
    await MetaAccount.findOneAndUpdate(
      {
        _id: id,
        enabled: true,

        $or: [
          {
            syncState: {
              $nin: ['QUEUED', 'RUNNING'],
            },
          },
          {
            syncState: 'RUNNING',
            lockUntil: {
              $lt: new Date(),
            },
          },
        ],
      },
      {
        $set: {
          requestedFrom: range.from,
          requestedTo: range.to,

          syncState: 'QUEUED',
          syncError: '',
          nextSyncAt: new Date(),
        },
      },
      {
        returnDocument: 'after',
      }
    ).lean();

  assert(
    row,
    409,
    'This account already has a queued or running sync. Wait for it to finish.'
  );

  return safeAccount(row, config);
}

export async function dashboard(
  user,
  query,
  config
) {
  const explicit =
    query.from !== undefined ||
    query.to !== undefined;

  if (explicit) {
    validateRange(query.from, query.to);
  }

  const { customers, accounts } =
    await visibleAccounts(
      user,
      query.customerId
    );

  const names = new Map(
    customers.map((c) => [
      c._id,
      c.businessName,
    ])
  );

  const result = [];

  for (const account of accounts) {
    const { today, monthStart } =
      accountDates(account.timezone);

    const from = explicit
      ? query.from
      : monthStart;

    const to = explicit
      ? query.to
      : today;

    const [
      report,
      todayReport,
      monthReport,
      campaigns,
    ] = await Promise.all([
      MetaReport.findOne({
        accountId: account._id,
        from,
        to,
      }).lean(),

      MetaReport.findOne({
        accountId: account._id,
        from: today,
        to: today,
      }).lean(),

      MetaReport.findOne({
        accountId: account._id,
        from: monthStart,
        to: today,
      }).lean(),

      MetaEntity.find({
        accountId: account._id,
        kind: 'campaign',
      })
        .select(
          'metaId name effectiveStatus dailyBudgetMinor lifetimeBudgetMinor startTime stopTime objective'
        )
        .lean(),
    ]);

    const metaById = new Map(
      campaigns.map((c) => [
        c.metaId,
        c,
      ])
    );

    const reportById = new Map(
      (report?.campaigns || []).map((c) => [
        c.metaId,
        c,
      ])
    );

    const campaignIds = new Set([
      ...metaById.keys(),
      ...reportById.keys(),
    ]);

    result.push({
      ...safeAccount(account, config),

      customerName:
        names.get(account.customerId),

      from,
      to,
      today,

      report: report
        ? {
            totals: report.totals,
            syncedAt: report.syncedAt,
          }
        : null,

      todaySpend:
        todayReport?.totals?.spend ??
        null,

      monthSpend:
        monthReport?.totals?.spend ??
        null,

      todaySyncedAt:
        todayReport?.syncedAt ??
        null,

      monthSyncedAt:
        monthReport?.syncedAt ??
        null,

      activeCampaigns:
        account.lastSyncedAt
          ? campaigns.filter(
              (c) =>
                c.effectiveStatus ===
                'ACTIVE'
            ).length
          : null,

      campaigns: [
        ...campaignIds,
      ].map((id) => {
        const c =
          metaById.get(id);

        const data =
          reportById.get(id);

        return {
          metaId: id,

          name:
            c?.name ||
            data?.name ||
            id,

          effectiveStatus:
            c?.effectiveStatus ||
            'UNKNOWN',

          objective:
            c?.objective,

          dailyBudgetMinor:
            c?.dailyBudgetMinor,

          lifetimeBudgetMinor:
            c?.lifetimeBudgetMinor,

          startTime:
            c?.startTime,

          stopTime:
            c?.stopTime,

          metrics:
            data ||
            (report
              ? metrics()
              : null),
        };
      }),
    });
  }

  const currencies = [
    ...new Set(
      result.map((a) => a.currency)
    ),
  ].map((currency) => {
    const matching =
      result.filter(
        (a) =>
          a.currency === currency
      );

    const reports =
      matching.filter(
        (a) => a.report
      );

    return {
      currency,

      totals: reports.length
        ? sumMetrics(
            reports.map(
              (a) =>
                a.report.totals
            )
          )
        : null,

      reportedAccounts:
        reports.length,

      totalAccounts:
        matching.length,

      todaySpend:
        matching.some(
          (a) =>
            a.todaySpend !== null
        )
          ? sumMetrics(
              matching.map(
                (a) => ({
                  spend:
                    a.todaySpend ||
                    0,
                })
              )
            ).spend
          : null,

      todayReportedAccounts:
        matching.filter(
          (a) =>
            a.todaySpend !== null
        ).length,

      monthSpend:
        matching.some(
          (a) =>
            a.monthSpend !== null
        )
          ? sumMetrics(
              matching.map(
                (a) => ({
                  spend:
                    a.monthSpend ||
                    0,
                })
              )
            ).spend
          : null,

      monthReportedAccounts:
        matching.filter(
          (a) =>
            a.monthSpend !== null
        ).length,
    };
  });

  return {
    accounts: result,
    currencies,

    clientCount: new Set(
      accounts.map(
        (a) => a.customerId
      )
    ).size,
  };
}

export async function detail(
  user,
  id,
  query
) {
  const account =
    await findAccount(user, id);

  const { today, monthStart } =
    accountDates(account.timezone);

  const { from, to } =
    validateRange(
      query.from || monthStart,
      query.to || today
    );

  const [entities, daily] =
    await Promise.all([
      MetaEntity.find({
        accountId: id,
      })
        .sort({
          kind: 1,
          name: 1,
        })
        .lean(),

      MetaDaily.find({
        accountId: id,

        date: {
          $gte: from,
          $lte: to,
        },
      })
        .sort({ date: 1 })
        .lean(),
    ]);

  return {
    entities:
      entities.map(plain),

    daily:
      daily.map(plain),

    currency:
      account.currency,

    timezone:
      account.timezone,
  };
}