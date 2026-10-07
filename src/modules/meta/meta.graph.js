import { createHmac } from "node:crypto";
import { ApiError, assert } from "../../utils/index.js";

// =====================================================
// SAFE META ERROR
// Never expose raw Meta errors, tokens or request URLs.
// =====================================================

export class MetaGraphError extends ApiError {
  constructor(code, transient = false) {
    const messages = {
      190:
        "Meta access token expired or invalid. Ask your administrator to replace the backend token.",

      10:
        "Meta permission missing. Check ads_read / ads_management and access to this ad account.",

      200:
        "Meta permission missing. Check ads_read / ads_management and access to this ad account.",

      100:
        "Meta rejected one or more request fields. Check the campaign configuration and Meta API version.",
    };

    super(
      422,
      messages[code] ||
        (
          transient
            ? "Meta is busy or rate-limited. Please try again later."
            : "Meta request failed. Check account access and the configured Meta API version."
        ),
    );

    this.code = code;
    this.transient = transient;
  }
}


// =====================================================
// META GRAPH CLIENT
// =====================================================

export class MetaGraph {

  constructor(
    config,
    connectionKey,
    {
      fetcher = fetch,
      heartbeat = async () => {},
    } = {},
  ) {

    const connection =
      config.meta?.connections?.[connectionKey];

    assert(
      connection && config.meta?.version,
      422,
      "Meta connection is not configured on the backend",
    );

    this.connection = connection;
    this.version = config.meta.version;
    this.fetcher = fetcher;
    this.heartbeat = heartbeat;
  }


  // =====================================================
  // APP SECRET PROOF
  // =====================================================

  appSecretProof() {

    if (!this.connection.appSecret) {
      return "";
    }

    return createHmac(
      "sha256",
      this.connection.appSecret,
    )
      .update(this.connection.accessToken)
      .digest("hex");
  }


  // =====================================================
  // VALIDATE GET PATH
  //
  // Examples:
  // act_123456
  // act_123456/campaigns
  // act_123456/adsets
  // act_123456/ads
  // act_123456/insights
  // =====================================================

validateGetPath(path) {

  assert(
    path === "search" ||

      // Meta ad account endpoints
      /^(act_\d+)(\/(campaigns|adsets|ads|insights|promote_pages|instagram_accounts))?$/.test(
        path
      ) ||

      // Facebook Page / Meta object ID
      /^\d{1,40}$/.test(
        path
      ),

    422,
    "Invalid Meta API path"
  );

}


  // =====================================================
  // VALIDATE POST PATH
  //
  // Used for creating:
  // Campaign
  // Ad Set
  // Creative
  // Ad
  // =====================================================

  validatePostPath(path) {

    assert(
      /^act_\d+\/(campaigns|adsets|adcreatives|ads)$/.test(
        path,
      ),
      422,
      "Invalid Meta management API path",
    );
  }


  // =====================================================
  // GET
  // =====================================================

  async get(path, params = {}) {

    this.validateGetPath(path);

    const url = new URL(
      `https://graph.facebook.com/${this.version}/${path}`,
    );


    // Add query parameters
    for (
      const [key, value]
      of Object.entries(params)
    ) {

      if (
        value === undefined ||
        value === null
      ) {
        continue;
      }

      url.searchParams.set(
        key,
        typeof value === "object"
          ? JSON.stringify(value)
          : String(value),
      );
    }


    // App secret proof
    const proof =
      this.appSecretProof();

    if (proof) {
      url.searchParams.set(
        "appsecret_proof",
        proof,
      );
    }


    return this.requestWithRetry(
      url,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${this.connection.accessToken}`,
        },

        signal:
          AbortSignal.timeout(25000),

        redirect: "error",
      },
    );
  }


  // =====================================================
  // POST
  //
  // This is what we need for:
  //
  // create campaign
  // create ad set
  // create creative
  // create ad
  // =====================================================

  async post(path, params = {}) {

    this.validatePostPath(path);

    const url = new URL(
      `https://graph.facebook.com/${this.version}/${path}`,
    );


    const body =
      new URLSearchParams();


    for (
      const [key, value]
      of Object.entries(params)
    ) {

      if (
        value === undefined ||
        value === null
      ) {
        continue;
      }

      body.set(
        key,
        typeof value === "object"
          ? JSON.stringify(value)
          : String(value),
      );
    }


    // App secret proof
    const proof =
      this.appSecretProof();

    if (proof) {
      body.set(
        "appsecret_proof",
        proof,
      );
    }


    return this.requestWithRetry(
      url,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${this.connection.accessToken}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body,

        signal:
          AbortSignal.timeout(25000),

        redirect: "error",
      },
    );
  }


  // =====================================================
  // REQUEST + RETRY
  // Shared by GET and POST
  // =====================================================

async requestWithRetry(
  url,
  options,
) {

  for (
    let attempt = 0;
    attempt < 3;
    attempt++
  ) {

    await this.heartbeat();

    let response;
    let body;


    try {

      response =
        await this.fetcher(
          url,
          options,
        );

      body =
        await response.json();

    } catch {

      if (attempt < 2) {

        await this.pause(attempt);

        continue;
      }

      throw new MetaGraphError(
        0,
        true,
      );
    }


    // =====================================================
    // SUCCESS
    // =====================================================

    if (
      response.ok &&
      !body.error
    ) {

      return body;

    }


    // =====================================================
    // META ERROR CODE
    // =====================================================

    const code =
      Number(
        body?.error?.code ||
        response.status,
      );


    // =====================================================
    // CHECK TRANSIENT ERROR
    // =====================================================

    const transient =
      response.status === 429 ||

      response.status >= 500 ||

      body?.error?.is_transient ||

      [
        4,
        17,
        32,
        613,
        80000,
        80004,
      ].includes(code);


    // =====================================================
    // RETRY TRANSIENT ERROR
    // =====================================================

    if (
      transient &&
      attempt < 2
    ) {

      await this.pause(attempt);

      continue;

    }


    // =====================================================
    // IMPORTANT:
    // PRINT REAL META ERROR IN BACKEND TERMINAL
    //
    // ACCESS TOKEN IS NOT PRINTED
    // =====================================================

    console.error(
      "META API ERROR:",
      {
        code,

        subcode:
          body?.error?.error_subcode,

        message:
          body?.error?.message,

        userTitle:
          body?.error?.error_user_title,

        userMessage:
          body?.error?.error_user_msg,

        type:
          body?.error?.type,
      }
    );


    // =====================================================
    // SEND SAFE ERROR TO FRONTEND
    // =====================================================

    throw new MetaGraphError(
      code,
      !!transient,
    );
  }


  throw new MetaGraphError(
    0,
    true,
  );
}

  // =====================================================
  // RETRY DELAY
  // =====================================================

  async pause(attempt) {

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          500 * 2 ** attempt,
        ),
    );
  }


  // =====================================================
  // GET ALL PAGINATED RESULTS
  // =====================================================

  async list(
    path,
    params = {},
  ) {

    let after;
    let pages = 0;

    const rows = [];
    const seen = new Set();


    do {

      const body =
        await this.get(
          path,
          {
            ...params,

            limit: 100,

            ...(after
              ? { after }
              : {}),
          },
        );


      assert(
        Array.isArray(body.data),
        422,
        "Meta returned an unexpected response",
      );


      rows.push(
        ...body.data,
      );


      assert(
        rows.length <= 10000 &&
          ++pages <= 150,

        422,

        "Account is too large for this sync. Use a smaller reporting range or extend the worker.",
      );


      after =
        body.paging?.next
          ? body.paging?.cursors?.after
          : undefined;


      assert(
        !body.paging?.next ||
          typeof after === "string",

        422,

        "Meta pagination was incomplete",
      );


      assert(
        !after ||
          !seen.has(after),

        422,

        "Meta pagination repeated a cursor",
      );


      if (after) {
        seen.add(after);
      }

    } while (after);


    return rows;
  }
}