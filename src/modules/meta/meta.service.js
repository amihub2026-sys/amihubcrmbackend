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
// =====================================================
// CREATE META CAMPAIGN
// Creates campaign as PAUSED.
// Does NOT start spending automatically.
// =====================================================

export async function createCampaign(
  user,
  accountId,
  body,
  config
) {
  // Only privileged CRM users can create Meta campaigns.
  authorize(user, true);

  assert(
    body &&
      typeof body.name === "string" &&
      body.name.trim().length >= 3 &&
      body.name.trim().length <= 200,
    422,
    "Enter a valid campaign name"
  );

  const allowedObjectives = [
    "OUTCOME_AWARENESS",
    "OUTCOME_TRAFFIC",
    "OUTCOME_ENGAGEMENT",
    "OUTCOME_LEADS",
    "OUTCOME_SALES",
    "OUTCOME_APP_PROMOTION"
  ];

  assert(
    typeof body.objective === "string" &&
      allowedObjectives.includes(body.objective),
    422,
    "Select a valid Meta campaign objective"
  );

  // Get linked CRM Meta account including backend connection key.
  const account = await findAccount(
    user,
    accountId,
    true
  );

  assert(
    account.enabled,
    409,
    "This Meta ad account is disabled in CRM"
  );

  assert(
    account.connectionKey,
    422,
    "Meta backend connection is missing"
  );

  const graph = new MetaGraph(
    config,
    account.connectionKey
  );

  // Always create PAUSED first.
  // We will add a separate Publish / Activate action later.
const meta = await graph.post(
  `${account.metaAccountId}/campaigns`,
  {
    name: body.name.trim(),

    objective: body.objective,

    buying_type: "AUCTION",

    status: "PAUSED",

    special_ad_categories:
      Array.isArray(body.specialAdCategories)
        ? body.specialAdCategories
        : [],

    // Current Meta API requires this when
    // campaign budget is NOT used and the
    // budget will be placed on the Ad Set.
    is_adset_budget_sharing_enabled: false
  }
);

  assert(
    meta &&
      typeof meta.id === "string" &&
      /^\d+$/.test(meta.id),
    422,
    "Meta did not return a campaign ID"
  );

  return {
    id: meta.id,
    name: body.name.trim(),
    objective: body.objective,
    status: "PAUSED",
    accountId: account._id,
    metaAccountId: account.metaAccountId
  };
}
// =====================================================
// CREATE META AD SET
//
// Handles:
// - Campaign
// - Daily budget
// - Start / End time
// - Location
// - Age
// - Gender
// - Audience targeting
//
// Always created as PAUSED.
// =====================================================

export async function createAdSet(
  user,
  accountId,
  body,
  config
) {
  authorize(user, true);


  // ===================================================
  // BASIC BODY
  // ===================================================

  assert(
    body &&
      typeof body === "object",
    422,
    "Invalid Ad Set details"
  );


  // ===================================================
  // CAMPAIGN ID
  // ===================================================

  assert(
    typeof body.campaignId === "string" &&
      /^\d+$/.test(body.campaignId),
    422,
    "Select a valid Meta campaign"
  );


  // ===================================================
  // AD SET NAME
  // ===================================================

  assert(
    typeof body.name === "string" &&
      body.name.trim().length >= 3 &&
      body.name.trim().length <= 200,
    422,
    "Enter a valid Ad Set name"
  );


  // ===================================================
  // DAILY BUDGET
  //
  // User enters:
  // ₹200
  //
  // Meta receives:
  // 20000 paise
  // ===================================================

  const dailyBudget =
    Number(body.dailyBudget);

  assert(
    Number.isFinite(dailyBudget) &&
      dailyBudget > 0 &&
      dailyBudget <= 1000000,
    422,
    "Enter a valid daily budget"
  );


  // ===================================================
  // AGE
  // ===================================================

  const ageMin =
    Number(body.ageMin);

  const ageMax =
    Number(body.ageMax);


  assert(
    Number.isInteger(ageMin) &&
      ageMin >= 18 &&
      ageMin <= 65,
    422,
    "Enter a valid minimum age"
  );


  assert(
    Number.isInteger(ageMax) &&
      ageMax >= ageMin &&
      ageMax <= 65,
    422,
    "Enter a valid maximum age"
  );


  // ===================================================
  // GENDER
  // ===================================================

  const allowedGenders = [
    "ALL",
    "MALE",
    "FEMALE"
  ];


  assert(
    typeof body.gender === "string" &&
      allowedGenders.includes(
        body.gender
      ),
    422,
    "Select a valid gender"
  );


  // ===================================================
  // META LOCATION KEY
  //
  // IMPORTANT:
  // This is NOT simply the word "Madurai".
  //
  // Meta targeting uses a location/city key.
  // We will build the location search API next.
  // ===================================================

  assert(
    typeof body.locationKey === "string" &&
      /^\d+$/.test(body.locationKey),
    422,
    "Select a valid Meta target location"
  );


  // ===================================================
  // START / END
  // ===================================================

  assert(
    typeof body.startTime === "string" &&
      Number.isFinite(
        Date.parse(body.startTime)
      ),
    422,
    "Select a valid start date"
  );


  assert(
    typeof body.endTime === "string" &&
      Number.isFinite(
        Date.parse(body.endTime)
      ),
    422,
    "Select a valid end date"
  );


  assert(
    Date.parse(body.endTime) >
      Date.parse(body.startTime),
    422,
    "End date must be after start date"
  );


  // ===================================================
  // META OPTIMIZATION SETTINGS
  //
  // Different campaign objectives can require different
  // optimization goals.
  // Angular will map these later.
  // ===================================================

  assert(
    typeof body.optimizationGoal === "string" &&
      /^[A-Z0-9_]{2,60}$/.test(
        body.optimizationGoal
      ),
    422,
    "Invalid optimization goal"
  );


  assert(
    typeof body.billingEvent === "string" &&
      /^[A-Z0-9_]{2,60}$/.test(
        body.billingEvent
      ),
    422,
    "Invalid billing event"
  );


  // ===================================================
  // GET LINKED META ACCOUNT
  // ===================================================

  const account =
    await findAccount(
      user,
      accountId,
      true
    );


  assert(
    account.enabled,
    409,
    "This Meta ad account is disabled in CRM"
  );


  assert(
    account.connectionKey,
    422,
    "Meta backend connection is missing"
  );


  // ===================================================
  // META GRAPH CLIENT
  // ===================================================

  const graph =
    new MetaGraph(
      config,
      account.connectionKey
    );


  // ===================================================
  // TARGETING
  // ===================================================

  const targeting = {

    age_min:
      ageMin,

    age_max:
      ageMax,

    geo_locations: {

      cities: [
        {
          key:
            body.locationKey
        }
      ]

    }

  };


  // Meta:
  // 1 = Male
  // 2 = Female
  //
  // No genders field = All
  // ===================================================

  if (
    body.gender === "MALE"
  ) {

    targeting.genders = [1];

  }


  if (
    body.gender === "FEMALE"
  ) {

    targeting.genders = [2];

  }


  // ===================================================
  // CREATE AD SET IN META
  //
  // Always PAUSED first.
  // ===================================================

  const payload = {

    campaign_id:
      body.campaignId,

    name:
      body.name.trim(),

    daily_budget:
      String(
        Math.round(
          dailyBudget * 100
        )
      ),

    billing_event:
      body.billingEvent,

    optimization_goal:
      body.optimizationGoal,

    bid_strategy:
      "LOWEST_COST_WITHOUT_CAP",

    targeting,

    start_time:
      body.startTime,

    end_time:
      body.endTime,

    status:
      "PAUSED"

  };


  // ===================================================
  // OPTIONAL DESTINATION TYPE
  // ===================================================

  if (
    typeof body.destinationType === "string" &&
    body.destinationType
  ) {

    payload.destination_type =
      body.destinationType;

  }


  // ===================================================
  // OPTIONAL PROMOTED OBJECT
  //
  // Some objectives such as Leads may need this.
  // ===================================================

  if (
    body.promotedObject &&
    typeof body.promotedObject === "object"
  ) {

    payload.promoted_object =
      body.promotedObject;

  }


  const meta =
    await graph.post(
      `${account.metaAccountId}/adsets`,
      payload
    );


  // ===================================================
  // VERIFY META RESPONSE
  // ===================================================

  assert(
    meta &&
      typeof meta.id === "string" &&
      /^\d+$/.test(meta.id),
    422,
    "Meta did not return an Ad Set ID"
  );


  // ===================================================
  // RETURN SAFE DATA
  // ===================================================

  return {

    id:
      meta.id,

    campaignId:
      body.campaignId,

    name:
      body.name.trim(),

    dailyBudget,

    ageMin,

    ageMax,

    gender:
      body.gender,

    locationKey:
      body.locationKey,

    startTime:
      body.startTime,

    endTime:
      body.endTime,

    status:
      "PAUSED",

    accountId:
      account._id,

    metaAccountId:
      account.metaAccountId

  };
}
// =====================================================
// SEARCH META TARGET LOCATIONS
//
// Example:
// Madurai
// Chennai
// Coimbatore
//
// Returns Meta's real city targeting key.
// =====================================================

export async function searchLocations(
  user,
  accountId,
  query,
  config
) {
  authorize(user, true);


  // ===================================================
  // SEARCH TEXT
  // ===================================================

  const q =
    String(query?.q || "")
      .trim();


  assert(
    q.length >= 2 &&
      q.length <= 80,
    422,
    "Enter at least 2 characters to search location"
  );


  // ===================================================
  // GET LINKED META ACCOUNT
  // ===================================================

  const account =
    await findAccount(
      user,
      accountId,
      true
    );


  assert(
    account.enabled,
    409,
    "This Meta ad account is disabled in CRM"
  );


  assert(
    account.connectionKey,
    422,
    "Meta backend connection is missing"
  );


  // ===================================================
  // META GRAPH CLIENT
  // ===================================================

  const graph =
    new MetaGraph(
      config,
      account.connectionKey
    );


  // ===================================================
  // META TARGETING SEARCH
  //
  // Search only Indian cities.
  // ===================================================

  const result =
    await graph.get(
      "search",
      {
        type:
          "adgeolocation",

        location_types:
          ["city"],

        q,

        country_code:
          "IN",

        limit:
          25
      }
    );


  // ===================================================
  // VALIDATE RESPONSE
  // ===================================================

  assert(
    Array.isArray(result?.data),
    422,
    "Meta returned an invalid location search response"
  );


  // ===================================================
  // RETURN ONLY SAFE FIELDS
  // ===================================================

  return {
    locations:
      result.data.map(
        (item) => ({
          key:
            String(item.key || ""),

          name:
            item.name || "",

          type:
            item.type || "",

          countryCode:
            item.country_code || "",

          countryName:
            item.country_name || "",

          region:
            item.region || "",

          regionId:
            item.region_id || ""
        })
      )
      .filter(
        (item) =>
          item.key &&
          item.name
      )
  };
}
// =====================================================
// GET META CREATIVE ASSETS
//
// Loads:
// - Facebook Pages available to the ad account
// - Instagram accounts available to the ad account
//
// Used later when creating the Ad Creative.
// =====================================================

// =====================================================
// GET META CREATIVE ASSETS
//
// Loads:
// - Facebook Pages available to the ad account
// - Instagram accounts available to the ad account
//
// If the ad account does not directly return Instagram,
// we also check the Instagram Business Account connected
// to each Facebook Page.
// =====================================================

export async function creativeAssets(
  user,
  accountId,
  config
) {
  authorize(user, true);


  // ===================================================
  // GET LINKED META ACCOUNT
  // ===================================================

  const account =
    await findAccount(
      user,
      accountId,
      true
    );


  assert(
    account.enabled,
    409,
    "This Meta ad account is disabled in CRM"
  );


  assert(
    account.connectionKey,
    422,
    "Meta backend connection is missing"
  );


  // ===================================================
  // META GRAPH CLIENT
  // ===================================================

  const graph =
    new MetaGraph(
      config,
      account.connectionKey
    );


  // ===================================================
  // LOAD FACEBOOK PAGES
  // ===================================================

  const pagesResponse =
    await graph.get(
      `${account.metaAccountId}/promote_pages`,
      {
        fields:
          "id,name",

        limit:
          100
      }
    );


  const pages =
    Array.isArray(
      pagesResponse?.data
    )
      ? pagesResponse.data
          .map(
            (item) => ({
              id:
                String(
                  item.id || ""
                ),

              name:
                item.name || ""
            })
          )
          .filter(
            (item) =>
              item.id &&
              item.name
          )
      : [];


  // ===================================================
  // FIRST TRY:
  // INSTAGRAM ACCOUNTS DIRECTLY FROM AD ACCOUNT
  // ===================================================

  const instagramResponse =
    await graph.get(
      `${account.metaAccountId}/instagram_accounts`,
      {
        fields:
          "id,name,username",

        limit:
          100
      }
    );


  let instagramAccounts =
    Array.isArray(
      instagramResponse?.data
    )
      ? instagramResponse.data
          .map(
            (item) => ({
              id:
                String(
                  item.id || ""
                ),

              name:
                item.name || "",

              username:
                item.username || ""
            })
          )
          .filter(
            (item) =>
              item.id
          )
      : [];


  // ===================================================
  // FALLBACK:
  // GET INSTAGRAM BUSINESS ACCOUNT FROM FACEBOOK PAGE
  //
  // This is useful when:
  // /act_xxx/instagram_accounts
  // returns []
  // ===================================================

  if (
    !instagramAccounts.length &&
    pages.length
  ) {

    const pageInstagramAccounts = [];


    for (const page of pages) {

      const pageMeta =
        await graph.get(
          page.id,
          {
            fields:
              "id,name,instagram_business_account{id,name,username}"
          }
        );


      const instagram =
        pageMeta?.instagram_business_account;


      if (
        instagram &&
        instagram.id
      ) {

        pageInstagramAccounts.push({
          id:
            String(
              instagram.id
            ),

          name:
            instagram.name || "",

          username:
            instagram.username || ""
        });

      }

    }


    // Remove duplicates
    instagramAccounts =
      [
        ...new Map(
          pageInstagramAccounts.map(
            (item) => [
              item.id,
              item
            ]
          )
        ).values()
      ];

  }


  // ===================================================
  // RETURN SAFE DATA
  // ===================================================

  return {
    pages,
    instagramAccounts
  };
}
// =====================================================
// CREATE META IMAGE AD
//
// Creates:
// - Ad Creative
// - Meta Ad
//
// The final Ad is ALWAYS created as PAUSED.
// No spending starts automatically.
// =====================================================

export async function createImageAd(
  user,
  accountId,
  body,
  config
) {
  authorize(user, true);


  // ===================================================
  // BASIC BODY
  // ===================================================

  assert(
    body &&
      typeof body === "object",
    422,
    "Invalid Meta Ad details"
  );


  // ===================================================
  // AD SET ID
  // ===================================================

  assert(
    typeof body.adSetId === "string" &&
      /^\d+$/.test(body.adSetId),
    422,
    "Select a valid Meta Ad Set"
  );


  // ===================================================
  // AD NAME
  // ===================================================

  const name =
    String(body.name || "")
      .trim();


  assert(
    name.length >= 3 &&
      name.length <= 200,
    422,
    "Enter a valid Ad name"
  );


  // ===================================================
  // FACEBOOK PAGE
  // ===================================================

  assert(
    typeof body.pageId === "string" &&
      /^\d+$/.test(body.pageId),
    422,
    "Select a Facebook Page"
  );


  // ===================================================
  // INSTAGRAM
  //
  // Optional.
  // ===================================================

  if (body.instagramAccountId) {

    assert(
      typeof body.instagramAccountId === "string" &&
        /^\d+$/.test(body.instagramAccountId),
      422,
      "Select a valid Instagram account"
    );

  }


  // ===================================================
  // PRIMARY TEXT
  // ===================================================

  const primaryText =
    String(body.primaryText || "")
      .trim();


  assert(
    primaryText.length >= 1 &&
      primaryText.length <= 2000,
    422,
    "Enter the Primary Text"
  );


  // ===================================================
  // HEADLINE
  // ===================================================

  const headline =
    String(body.headline || "")
      .trim();


  assert(
    headline.length <= 255,
    422,
    "Headline is too long"
  );


  // ===================================================
  // DESCRIPTION
  // ===================================================

  const description =
    String(body.description || "")
      .trim();


  assert(
    description.length <= 1000,
    422,
    "Description is too long"
  );


  // ===================================================
  // DESTINATION URL
  //
  // Must be a public HTTPS URL.
  // localhost cannot be used by Meta.
  // ===================================================

  const destinationUrl =
    String(body.destinationUrl || "")
      .trim();


  assert(
    /^https:\/\/[^\s]+$/i.test(
      destinationUrl
    ),
    422,
    "Enter a public HTTPS destination URL"
  );


  // ===================================================
  // IMAGE URL
  //
  // Meta must be able to download this image.
  // Therefore it must also be public HTTPS.
  // ===================================================

  const imageUrl =
    String(body.imageUrl || "")
      .trim();


  assert(
    /^https:\/\/[^\s]+$/i.test(
      imageUrl
    ),
    422,
    "Enter a public HTTPS image URL"
  );


  // ===================================================
  // CALL TO ACTION
  // ===================================================

  const allowedCallToActions = [

    "LEARN_MORE",

    "CONTACT_US",

    "SIGN_UP",

    "GET_QUOTE",

    "APPLY_NOW",

    "BOOK_NOW",

    "SHOP_NOW",

    "SEND_MESSAGE"

  ];


  assert(
    typeof body.callToAction === "string" &&
      allowedCallToActions.includes(
        body.callToAction
      ),
    422,
    "Select a valid Call To Action"
  );


  // ===================================================
  // GET LINKED META ACCOUNT
  // ===================================================

  const account =
    await findAccount(
      user,
      accountId,
      true
    );


  assert(
    account.enabled,
    409,
    "This Meta ad account is disabled in CRM"
  );


  assert(
    account.connectionKey,
    422,
    "Meta backend connection is missing"
  );


  // ===================================================
  // META GRAPH CLIENT
  // ===================================================

  const graph =
    new MetaGraph(
      config,
      account.connectionKey
    );


  // ===================================================
  // LINK DATA
  // ===================================================

  const linkData = {

    message:
      primaryText,

    link:
      destinationUrl,

    picture:
      imageUrl,

    call_to_action: {
      type:
        body.callToAction
    }

  };


  // Optional headline
  if (headline) {

    linkData.name =
      headline;

  }


  // Optional description
  if (description) {

    linkData.description =
      description;

  }


  // ===================================================
  // OBJECT STORY SPEC
  // ===================================================

  const objectStorySpec = {

    page_id:
      body.pageId,

    link_data:
      linkData

  };


  // Use Instagram when selected
if (body.instagramAccountId) {

  objectStorySpec.instagram_user_id =
    body.instagramAccountId;

}


  // ===================================================
  // CREATIVE
  // ===================================================

  const creative = {

    object_story_spec:
      objectStorySpec

  };


  // ===================================================
  // CREATE REAL META AD
  //
  // IMPORTANT:
  // Always PAUSED.
  // ===================================================

  const meta =
    await graph.post(
      `${account.metaAccountId}/ads`,
      {

        name,

        adset_id:
          body.adSetId,

        creative,

        status:
          "PAUSED"

      }
    );


  // ===================================================
  // VERIFY META RESPONSE
  // ===================================================

  assert(
    meta &&
      typeof meta.id === "string" &&
      /^\d+$/.test(meta.id),
    422,
    "Meta did not return an Ad ID"
  );


  // ===================================================
  // RETURN SAFE DATA
  // ===================================================

  return {

    id:
      meta.id,

    name,

    adSetId:
      body.adSetId,

    pageId:
      body.pageId,

    instagramAccountId:
      body.instagramAccountId || "",

    imageUrl,

    destinationUrl,

    callToAction:
      body.callToAction,

    status:
      "PAUSED",

    accountId:
      account._id,

    metaAccountId:
      account.metaAccountId

  };
}